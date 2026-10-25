import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import type { AppConfig } from '../config/app-config';
import { SiteRevalidateInterceptor } from './site-revalidate.interceptor';

function context(method: string, url: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url }) })
  } as unknown as ExecutionContext;
}

const handler: CallHandler = { handle: () => of({ ok: true }) };

function interceptor(enabled: boolean): SiteRevalidateInterceptor {
  const config = {
    values: {
      siteRevalidate: enabled ? { url: 'http://web/api/site-revalidate', secret: 's3cr3t' } : null
    }
  } as unknown as AppConfig;

  return new SiteRevalidateInterceptor(config);
}

describe('SiteRevalidateInterceptor', () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => jest.useRealTimers());

  it('avisa o site uma única vez após alterações seguidas', async () => {
    const subject = interceptor(true);

    await lastValueFrom(subject.intercept(context('PATCH', '/api/v1/teams/1'), handler));
    await lastValueFrom(subject.intercept(context('POST', '/api/v1/news'), handler));
    jest.advanceTimersByTime(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://web/api/site-revalidate',
      expect.objectContaining({ headers: { 'x-revalidate-secret': 's3cr3t' } })
    );
  });

  it('ignora leituras, login e área da própria conta', async () => {
    const subject = interceptor(true);

    await lastValueFrom(subject.intercept(context('GET', '/api/v1/teams'), handler));
    await lastValueFrom(subject.intercept(context('POST', '/api/v1/auth/login'), handler));
    await lastValueFrom(subject.intercept(context('PATCH', '/api/v1/me/profile'), handler));
    jest.advanceTimersByTime(1_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fica desligado sem segredo configurado', async () => {
    await lastValueFrom(interceptor(false).intercept(context('PATCH', '/api/v1/teams/1'), handler));
    jest.advanceTimersByTime(1_000);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
