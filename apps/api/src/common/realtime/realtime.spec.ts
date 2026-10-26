import type { Request } from 'express';

import { originOf, sseFrame } from '../../modules/realtime/realtime.module';
import { envelopes, listenerUrl, matches, type RealtimeSubscriber } from './realtime.service';

const subscriber = (userId: string, permissions: string[]): RealtimeSubscriber => ({
  userId,
  permissions: new Set(permissions),
  send: () => undefined,
  close: () => undefined
});

describe('tempo real', () => {
  it('tira do endereço os parâmetros do Prisma e mantém o sslmode', () => {
    expect(
      listenerUrl('postgresql://u:p@db:5432/fenix?schema=public&connection_limit=5&sslmode=require')
    ).toBe('postgresql://u:p@db:5432/fenix?sslmode=require');
    expect(listenerUrl('postgresql://u:p@db:5432/fenix?schema=public')).toBe(
      'postgresql://u:p@db:5432/fenix'
    );
  });

  it('entrega à pessoa indicada ou a quem tem a permissão', () => {
    const staff = subscriber('a', ['dashboard.read']);
    const member = subscriber('b', []);

    expect(matches(staff, { permission: 'dashboard.read' })).toBe(true);
    expect(matches(member, { permission: 'dashboard.read' })).toBe(false);
    expect(matches(member, { userIds: ['b', 'c'] })).toBe(true);
    expect(matches(staff, { userIds: ['b'] })).toBe(false);
  });

  it('divide listas grandes de pessoas em lotes de 100', () => {
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    const chunks = envelopes([{ userIds: ids }, { permission: 'dashboard.read' }]);

    expect(chunks.map((c) => ('userIds' in c ? c.userIds.length : 'p'))).toEqual([
      100,
      100,
      50,
      'p'
    ]);
  });

  it('aceita só identificador de aba bem formado', () => {
    const req = (value?: string) =>
      ({ header: (name: string) => (name === 'x-client-id' ? value : undefined) }) as Request;

    expect(originOf(req('3f2b8c1e-aba-1'))).toBe('3f2b8c1e-aba-1');
    expect(originOf(req('<script>'))).toBeUndefined();
    expect(originOf(req())).toBeUndefined();
  });

  it('formata o evento no padrão Server-Sent Events', () => {
    expect(sseFrame({ type: 'changed', origin: 'aba-12345' })).toBe(
      'event: changed\ndata: {"type":"changed","origin":"aba-12345"}\n\n'
    );
  });
});
