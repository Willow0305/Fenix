import { PUBLIC_TOPIC_NAMES, type RealtimeTopic } from '@fenix/validation';

import { sseFrame } from '../../modules/realtime/realtime.module';
import { PUBLIC_REALTIME_TOPICS, visibleTopics } from '../../modules/realtime/domain/topic-access';
import type { PrismaService } from '../prisma/prisma.service';
import {
  CHANGES_COALESCE_MS,
  envelopes,
  listenerUrl,
  matches,
  type RealtimeEvent,
  RealtimeService,
  type RealtimeSubscriber
} from './realtime.service';

const subscriber = (
  userId: string | null,
  permissions: string[],
  received: RealtimeEvent[] = []
): RealtimeSubscriber => ({
  userId,
  permissions: new Set(permissions),
  topics: visibleTopics(new Set(permissions)),
  send: (event) => received.push(event),
  close: () => undefined
});

const changedTopics = (events: RealtimeEvent[]): RealtimeTopic[][] =>
  events.flatMap((event) => (event.type === 'changed' ? [[...event.topics]] : []));

describe('tempo real', () => {
  it('tira do endereço os parâmetros do Prisma e mantém o sslmode', () => {
    expect(
      listenerUrl('postgresql://u:p@db:5432/fenix?schema=public&connection_limit=5&sslmode=require')
    ).toBe('postgresql://u:p@db:5432/fenix?sslmode=require');
    expect(listenerUrl('postgresql://u:p@db:5432/fenix?schema=public')).toBe(
      'postgresql://u:p@db:5432/fenix'
    );
  });

  it('entrega à pessoa indicada, a quem tem a permissão ou a quem acompanha o assunto', () => {
    const staff = subscriber('a', ['dashboard.read']);
    const member = subscriber('b', []);
    const visitor = subscriber(null, []);

    expect(matches(staff, { permission: 'dashboard.read' })).toBe(true);
    expect(matches(member, { permission: 'dashboard.read' })).toBe(false);
    expect(matches(member, { userIds: ['b', 'c'] })).toBe(true);
    expect(matches(staff, { userIds: ['b'] })).toBe(false);
    expect(matches(visitor, { userIds: ['b'] })).toBe(false);
    expect(matches(visitor, { topic: 'store' })).toBe(true);
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

  it('formata o evento no padrão Server-Sent Events', () => {
    expect(sseFrame({ type: 'changed', topics: ['fees', 'payments'] })).toBe(
      'event: changed\ndata: {"type":"changed","topics":["fees","payments"]}\n\n'
    );
  });
});

describe('quem recebe cada assunto (DT-116)', () => {
  it('visitante e pessoa sem permissão recebem só os assuntos públicos', () => {
    const topics = visibleTopics(new Set());

    expect([...topics].sort()).toEqual([...PUBLIC_REALTIME_TOPICS].sort());
    expect(topics.has('store')).toBe(true);
    expect(topics.has('news')).toBe(true);
    expect(topics.has('orders')).toBe(false);
    expect(topics.has('finance')).toBe(false);
    expect(topics.has('audit')).toBe(false);
  });

  it('a lista pública do site é a mesma que a API libera para todos', () => {
    expect([...PUBLIC_TOPIC_NAMES].sort()).toEqual([...PUBLIC_REALTIME_TOPICS].sort());
  });

  it('papel com só uma área recebe essa área e o pagamento ligado a ela', () => {
    const topics = visibleTopics(new Set(['fees.read']));

    expect(topics.has('fees')).toBe(true);
    expect(topics.has('payments')).toBe(true);
    expect(topics.has('orders')).toBe(false);
    expect(topics.has('finance')).toBe(false);
    expect(topics.has('athletes')).toBe(false);
  });

  it('dados pessoais sensíveis ficam só com quem cuida deles', () => {
    expect(visibleTopics(new Set(['orders.read'])).has('privacy')).toBe(false);
    expect(visibleTopics(new Set(['privacy.requests.manage'])).has('privacy')).toBe(true);
    expect(visibleTopics(new Set(['finance.read'])).has('audit')).toBe(false);
  });
});

describe('mudanças avisadas pelo banco', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const service = () => new RealtimeService({} as PrismaService);

  it('junta as mudanças seguidas num aviso só e entrega a cada um o que pode ver', () => {
    const realtime = service();
    const financeiro: RealtimeEvent[] = [];
    const loja: RealtimeEvent[] = [];
    const visitante: RealtimeEvent[] = [];

    realtime.subscribe(subscriber('f', ['fees.read', 'finance.read'], financeiro));
    realtime.subscribe(subscriber('l', ['orders.read'], loja));
    realtime.subscribe(subscriber(null, [], visitante));

    realtime.receiveChange('payments');
    realtime.receiveChange('fees');
    realtime.receiveChange('finance');
    realtime.receiveChange('fees');
    realtime.receiveChange('store');

    expect(financeiro).toEqual([]);
    jest.advanceTimersByTime(CHANGES_COALESCE_MS);

    expect(changedTopics(financeiro)).toEqual([['fees', 'finance', 'payments', 'store']]);
    expect(changedTopics(loja)).toEqual([['payments', 'store']]);
    expect(changedTopics(visitante)).toEqual([['store']]);
  });

  it('não avisa quem não pode ver nenhum dos assuntos', () => {
    const realtime = service();
    const visitante: RealtimeEvent[] = [];

    realtime.subscribe(subscriber(null, [], visitante));
    realtime.receiveChange('audit');
    jest.advanceTimersByTime(CHANGES_COALESCE_MS);

    expect(visitante).toEqual([]);
  });

  it('mudança com dono vai para o dono, mesmo sem permissão, e para quem acompanha o pedido', () => {
    const realtime = service();
    const owner = '3f2b8c1e-0000-4000-8000-0000000000aa';
    const order = '3f2b8c1e-0000-4000-8000-0000000000bb';
    const dono: RealtimeEvent[] = [];
    const outro: RealtimeEvent[] = [];
    const semConta: RealtimeEvent[] = [];
    const loja: RealtimeEvent[] = [];

    realtime.subscribe(subscriber(owner, [], dono));
    realtime.subscribe(subscriber('3f2b8c1e-0000-4000-8000-0000000000cc', [], outro));
    realtime.subscribe({
      ...subscriber(null, []),
      watching: new Set([order]),
      send: (e) => semConta.push(e)
    });
    realtime.subscribe(subscriber('l', ['orders.read'], loja));

    realtime.receiveChange('orders');
    realtime.receiveChange(`orders:${owner}`);
    realtime.receiveChange(`payments:${owner.toUpperCase()}`);
    realtime.receiveChange(`orders:${order}`);
    jest.advanceTimersByTime(CHANGES_COALESCE_MS);

    expect(changedTopics(dono)).toEqual([['orders', 'payments']]);
    expect(changedTopics(outro)).toEqual([]);
    expect(changedTopics(semConta)).toEqual([['orders']]);
    expect(changedTopics(loja)).toEqual([['orders']]);
  });

  it('ignora dono malformado', () => {
    const realtime = service();
    const dono: RealtimeEvent[] = [];

    realtime.subscribe(subscriber('x', [], dono));
    realtime.receiveChange('orders:x');
    realtime.receiveChange('orders:3f2b8c1e-0000-4000-8000-0000000000aa:extra');
    jest.advanceTimersByTime(CHANGES_COALESCE_MS);

    expect(dono).toEqual([]);
  });

  it('ignora assunto desconhecido', () => {
    const realtime = service();
    const staff: RealtimeEvent[] = [];

    realtime.subscribe(subscriber('a', ['audit.read'], staff));
    realtime.receiveChange('outra-coisa');
    realtime.receiveChange('{"to":1}');
    jest.advanceTimersByTime(CHANGES_COALESCE_MS);

    expect(staff).toEqual([]);
  });
});
