import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import type { AppConfig } from '../config/app-config';
import type { RealtimeService } from '../realtime/realtime.service';
import {
  publicTopicsOf,
  SiteRevalidateInterceptor,
  SiteRevalidateService
} from './site-revalidate.interceptor';

function context(method: string, path: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, path }) })
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of({ ok: true }) };

describe('SiteRevalidateInterceptor', () => {
  const calls: string[] = [];
  const fetchMock = jest.fn().mockImplementation(async () => {
    calls.push('cache');

    return { ok: true, status: 204 };
  });
  const publish = jest.fn().mockImplementation(async () => {
    calls.push('aviso');
  });

  function interceptor(enabled: boolean): SiteRevalidateInterceptor {
    const config = {
      values: {
        siteRevalidate: enabled ? { url: 'http://web/api/site-revalidate', secret: 's3cr3t' } : null
      }
    } as unknown as AppConfig;

    return new SiteRevalidateInterceptor(
      new SiteRevalidateService(config, { publish } as unknown as RealtimeService)
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockClear();
    publish.mockClear();
    calls.length = 0;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => jest.useRealTimers());

  it('avisa o site uma única vez após alterações seguidas', async () => {
    const subject = interceptor(true);

    await lastValueFrom(subject.intercept(context('PATCH', '/api/v1/teams/1'), handler));
    await lastValueFrom(subject.intercept(context('POST', '/api/v1/news'), handler));
    await jest.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://web/api/site-revalidate',
      expect.objectContaining({ headers: { 'x-revalidate-secret': 's3cr3t' } })
    );
  });

  it('descarta o cache antes de avisar as páginas da loja e das seletivas', async () => {
    const subject = interceptor(true);

    await lastValueFrom(subject.intercept(context('POST', '/api/v1/orders/checkout'), handler));
    await lastValueFrom(
      subject.intercept(context('POST', '/api/v1/public/tryouts/sub-15/registrations'), handler)
    );
    await jest.advanceTimersByTimeAsync(1_000);

    expect(calls).toEqual(['cache', 'aviso']);
    expect(publish).toHaveBeenCalledWith([{ topic: 'store' }, { topic: 'tryouts' }], {
      type: 'catalog'
    });
  });

  it('ignora leituras, login, conta própria e carrinho', async () => {
    const subject = interceptor(true);

    await lastValueFrom(subject.intercept(context('GET', '/api/v1/teams'), handler));
    await lastValueFrom(subject.intercept(context('POST', '/api/v1/auth/login'), handler));
    await lastValueFrom(subject.intercept(context('PATCH', '/api/v1/me/profile'), handler));
    await lastValueFrom(subject.intercept(context('PUT', '/api/v1/cart/items'), handler));
    await jest.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('sem segredo configurado, não chama o site mas avisa as páginas', async () => {
    await lastValueFrom(
      interceptor(false).intercept(context('PATCH', '/api/v1/store/products/1'), handler)
    );
    await jest.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith([{ topic: 'store' }], { type: 'catalog' });
  });
});

describe('publicTopicsOf', () => {
  it.each([
    ['/api/v1/store/products/1/images', ['store']],
    ['/api/v1/orders/checkout', ['store']],
    ['/api/v1/campaigns/1/close', ['store']],
    ['/api/v1/tryouts/1/status', ['tryouts']],
    ['/api/v1/tryout-registrations/1/status', ['tryouts']],
    ['/api/v1/news/1', []],
    ['/api/v1/storefront', []]
  ])('%s → %p', (path, topics) => {
    expect(publicTopicsOf(path)).toEqual(topics);
  });
});
