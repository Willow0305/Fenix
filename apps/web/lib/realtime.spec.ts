import { isOwnResource, parseEvents, shouldReload } from './realtime';

describe('tempo real no navegador', () => {
  it('lê eventos completos e guarda o resto', () => {
    const { events, rest } = parseEvents(
      'retry: 3000\n\nevent: ready\ndata: {}\n\nevent: changed\ndata: {"type":"changed","topics":["orders","payments"]}\n\n: ping\n\nevent: notif'
    );

    expect(events).toEqual([{ type: 'changed', topics: ['orders', 'payments'] }]);
    expect(rest).toBe('event: notif');
    expect(parseEvents(`${rest}ication\ndata: {}\n\n`).events).toEqual([{ type: 'notification' }]);
  });

  it('descarta assunto desconhecido e evento sem assunto', () => {
    expect(
      parseEvents('event: changed\ndata: {"topics":["orders","<script>"]}\n\n').events
    ).toEqual([{ type: 'changed', topics: ['orders'] }]);
    expect(parseEvents('event: changed\ndata: {"topics":[]}\n\n').events).toEqual([]);
    expect(parseEvents('event: catalog\ndata: não é json\n\n').events).toEqual([]);
    expect(parseEvents('event: catalog\ndata: {"topics":["store"]}\n\n').events).toEqual([
      { type: 'catalog', topics: ['store'] }
    ]);
  });

  it('reconhece os recursos da própria pessoa', () => {
    expect(isOwnResource('/me')).toBe(true);
    expect(isOwnResource('/me/orders?page=1')).toBe(true);
    expect(isOwnResource('/media/1')).toBe(false);
    expect(isOwnResource('/store/orders')).toBe(false);
  });

  it('notificação recarrega só o que é da pessoa', () => {
    expect(shouldReload('/me/notifications', { type: 'notification' })).toBe(true);
    expect(shouldReload('/store/orders', { type: 'notification' })).toBe(false);
  });

  it('mudança recarrega só as telas que mostram o assunto (DT-116)', () => {
    const payment = { type: 'changed', topics: ['payments'] } as const;

    expect(shouldReload('/store/orders', payment)).toBe(true);
    expect(shouldReload('/monthly-fees', payment)).toBe(true);
    expect(shouldReload('/finance/summary', payment)).toBe(true);
    expect(shouldReload('/dashboard/summary', payment)).toBe(true);
    expect(shouldReload('/me/orders/1', payment)).toBe(true);
    expect(shouldReload('/news', payment)).toBe(false);
    expect(shouldReload('/store/products', payment)).toBe(false);
    expect(shouldReload('/me/sessions', payment)).toBe(false);
  });

  it('ressincronização recarrega tudo; aviso das páginas em cache não mexe nas consultas', () => {
    expect(shouldReload('/me/orders', { type: 'resync' })).toBe(true);
    expect(shouldReload('/news', { type: 'resync' })).toBe(true);
    expect(shouldReload('/public/products', { type: 'catalog', topics: ['store'] })).toBe(false);
  });
});
