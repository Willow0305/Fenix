import {
  forgetGuestOrder,
  guestOrderLink,
  parseGuestOrderHash,
  REMEMBER_DAYS,
  rememberedGuestOrders,
  rememberGuestOrder
} from './guest-orders';

const DAY = 86_400_000;

describe('pedidos sem conta no aparelho (DT-096)', () => {
  beforeEach(() => window.localStorage.clear());

  it('o link fixo e a leitura do # combinam', () => {
    const link = guestOrderLink('FNX-261101-ABC123', 'K7QH-3MXP');

    expect(link).toBe('/loja/pedido#pedido=FNX-261101-ABC123&codigo=K7QH-3MXP');
    expect(parseGuestOrderHash(link.slice(link.indexOf('#')))).toEqual({
      orderNumber: 'FNX-261101-ABC123',
      code: 'K7QH-3MXP'
    });
    expect(parseGuestOrderHash('#pedido=FNX-1')).toBeNull();
    expect(parseGuestOrderHash('')).toBeNull();
  });

  it('lembra, atualiza sem repetir e esquece', () => {
    rememberGuestOrder({ orderNumber: 'A', code: '1' }, 1000);
    rememberGuestOrder({ orderNumber: 'B', code: '2' }, 2000);
    rememberGuestOrder({ orderNumber: 'A', code: '1' }, 3000);

    expect(rememberedGuestOrders(3000).map((o) => o.orderNumber)).toEqual(['A', 'B']);

    forgetGuestOrder('A', 3000);
    expect(rememberedGuestOrders(3000).map((o) => o.orderNumber)).toEqual(['B']);
  });

  it(`esquece sozinho depois de ${REMEMBER_DAYS} dias`, () => {
    rememberGuestOrder({ orderNumber: 'A', code: '1' }, 0);

    expect(rememberedGuestOrders(REMEMBER_DAYS * DAY - 1)).toHaveLength(1);
    expect(rememberedGuestOrders(REMEMBER_DAYS * DAY)).toHaveLength(0);
  });

  it('ignora dado corrompido no aparelho', () => {
    window.localStorage.setItem('fenix:pedidos-sem-conta', '{quebrado');

    expect(rememberedGuestOrders()).toEqual([]);
  });
});
