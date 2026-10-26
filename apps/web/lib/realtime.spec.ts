import { clientId, isOwnResource, parseEvents, shouldReload } from './realtime';

describe('tempo real no navegador', () => {
  it('lê eventos completos e guarda o resto', () => {
    const { events, rest } = parseEvents(
      'retry: 3000\n\nevent: ready\ndata: {}\n\nevent: changed\ndata: {"type":"changed","origin":"aba-1"}\n\n: ping\n\nevent: notif'
    );

    expect(events).toEqual([{ type: 'changed', origin: 'aba-1' }]);
    expect(rest).toBe('event: notif');
    expect(parseEvents(`${rest}ication\ndata: {}\n\n`).events).toEqual([{ type: 'notification' }]);
  });

  it('reconhece os recursos da própria pessoa', () => {
    expect(isOwnResource('/me')).toBe(true);
    expect(isOwnResource('/me/orders?page=1')).toBe(true);
    expect(isOwnResource('/media/1')).toBe(false);
    expect(isOwnResource('/store/orders')).toBe(false);
  });

  it('notificação recarrega só o que é da pessoa; mudança só o painel, exceto a própria aba', () => {
    expect(shouldReload('/me/notifications', { type: 'notification' })).toBe(true);
    expect(shouldReload('/store/orders', { type: 'notification' })).toBe(false);
    expect(shouldReload('/store/orders', { type: 'changed', origin: 'outra-aba' })).toBe(true);
    expect(shouldReload('/store/orders', { type: 'changed', origin: clientId() })).toBe(false);
    expect(shouldReload('/me/orders', { type: 'changed' })).toBe(false);
    expect(shouldReload('/me/orders', { type: 'resync' })).toBe(true);
  });
});
