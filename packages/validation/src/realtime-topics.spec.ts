import { isRealtimeTopic, REALTIME_TOPICS, topicsOfPath } from './realtime-topics';

describe('assuntos do tempo real (DT-116)', () => {
  it('um pagamento confirmado atualiza pedido, mensalidade, Caixa, painel e área da pessoa', () => {
    const screens = [
      '/store/orders',
      '/store/orders/abc',
      '/monthly-fees',
      '/finance/transactions',
      '/finance/summary',
      '/dashboard/summary',
      '/me/orders/abc',
      '/me/monthly-fees'
    ];

    screens.forEach((path) => expect(topicsOfPath(path)).toContain('payments'));
  });

  it('ignora a consulta e soma as regras que casam', () => {
    expect(topicsOfPath('/store/orders?page=2')).toEqual(['orders', 'payments', 'delivery']);
    expect(topicsOfPath('/partners/sales-report')).toEqual(
      expect.arrayContaining(['orders', 'payments', 'settlements', 'partners'])
    );
  });

  it('telas sem assunto não recarregam sozinhas', () => {
    expect(topicsOfPath('/me/sessions')).toEqual([]);
    expect(topicsOfPath('/auth/trusted-devices')).toEqual([]);
    expect(topicsOfPath('/search')).toEqual([]);
  });

  it('não confunde caminhos parecidos', () => {
    expect(topicsOfPath('/cards')).toContain('cards');
    expect(topicsOfPath('/me/cards')).not.toContain('athletes');
    expect(topicsOfPath('/newsletter')).toEqual([]);
  });

  it('reconhece só os assuntos da lista', () => {
    expect(REALTIME_TOPICS.every(isRealtimeTopic)).toBe(true);
    expect(isRealtimeTopic('outra')).toBe(false);
    expect(isRealtimeTopic(1)).toBe(false);
  });
});
