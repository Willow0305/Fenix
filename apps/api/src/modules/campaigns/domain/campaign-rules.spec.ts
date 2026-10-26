import { canTransition } from '../../../common/domain/state-machine';
import {
  assertWindow,
  CAMPAIGN_TRANSITIONS,
  canOpen,
  consolidate,
  isEditable,
  minimumReached
} from './campaign-rules';

describe('regras de remessas', () => {
  it('segue o ciclo com o fornecedor e permite reabrir para estender', () => {
    expect(canTransition(CAMPAIGN_TRANSITIONS, 'CLOSED', 'OPEN')).toBe(true);
    expect(canTransition(CAMPAIGN_TRANSITIONS, 'CLOSED', 'ORDERED')).toBe(true);
    expect(canTransition(CAMPAIGN_TRANSITIONS, 'OPEN', 'ORDERED')).toBe(false);
    expect(canTransition(CAMPAIGN_TRANSITIONS, 'RECEIVED', 'CANCELLED')).toBe(false);
    expect(canTransition(CAMPAIGN_TRANSITIONS, 'COMPLETED', 'OPEN')).toBe(false);
  });

  it('bloqueia a configuração depois da encomenda', () => {
    expect(isEditable('CLOSED')).toBe(true);
    expect(isEditable('ORDERED')).toBe(false);
  });

  it('valida o período de vendas', () => {
    const now = new Date('2026-10-19T12:00:00Z');

    expect(assertWindow({ salesStartAt: now, salesEndAt: now })).not.toBeNull();
    expect(canOpen({ salesStartAt: now, salesEndAt: new Date('2026-10-19T11:00:00Z') }, now)).toBe(
      false
    );
  });

  it('confere a quantidade mínima paga', () => {
    expect(minimumReached({ minimumQuantity: 20, paidQuantity: 19 })).toBe(false);
    expect(minimumReached({ minimumQuantity: null, paidQuantity: 0 })).toBe(true);
  });

  it('consolida por SKU e exporta CSV com segurança', () => {
    const lines = consolidate([
      { productId: 'p', productName: 'Camisa', variantName: 'M', sku: 'CAM-M', quantity: 2 },
      { productId: 'p', productName: 'Camisa', variantName: 'G', sku: 'CAM-G', quantity: 1 },
      { productId: 'p', productName: 'Camisa', variantName: 'M', sku: 'CAM-M', quantity: 3 }
    ]);

    expect(lines.map((l) => [l.sku, l.quantity])).toEqual([
      ['CAM-G', 1],
      ['CAM-M', 5]
    ]);
  });
});
