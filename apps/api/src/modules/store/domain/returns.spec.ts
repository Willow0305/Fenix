import { money } from '../../../common/domain/money';
import { canReportDefect, canWithdraw, refundForUnits, returnDeadlines } from './returns';

const delivered = new Date('2026-10-10T15:00:00Z');
const day = 86_400_000;

describe('desistência e defeito (DT-070)', () => {
  it('desistência: pago e não entregue pode; entregue, até 7 dias da prova', () => {
    expect(canWithdraw({ status: 'PAID', deliveryConfirmedAt: null }, new Date())).toBe(true);
    expect(canWithdraw({ status: 'AWAITING_PAYMENT', deliveryConfirmedAt: null }, new Date())).toBe(
      false
    );

    const order = { status: 'DELIVERED', deliveryConfirmedAt: delivered };

    expect(canWithdraw(order, new Date(delivered.getTime() + 7 * day))).toBe(true);
    expect(canWithdraw(order, new Date(delivered.getTime() + 7 * day + 1))).toBe(false);
  });

  it('sem prova de entrega, o prazo ainda não começou', () => {
    const order = { status: 'DELIVERED', deliveryConfirmedAt: null };

    expect(canWithdraw(order, new Date('2030-01-01'))).toBe(true);
    expect(returnDeadlines(order)).toEqual({ withdrawalUntil: null, defectUntil: null });
  });

  it('defeito: só entregue, até 90 dias', () => {
    const order = { status: 'DELIVERED', deliveryConfirmedAt: delivered };

    expect(canReportDefect({ status: 'PAID', deliveryConfirmedAt: null }, new Date())).toBe(false);
    expect(canReportDefect(order, new Date(delivered.getTime() + 90 * day))).toBe(true);
    expect(canReportDefect(order, new Date(delivered.getTime() + 91 * day))).toBe(false);
  });

  it('devolve a parte das unidades, com o desconto já aplicado', () => {
    expect(refundForUnits(money('230.00'), 2, 1).toFixed(2)).toBe('115.00');
    expect(refundForUnits(money('100.00'), 3, 1).toFixed(2)).toBe('33.33');
  });
});
