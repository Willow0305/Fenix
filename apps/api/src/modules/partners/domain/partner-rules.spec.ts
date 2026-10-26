import { canTransition } from '../../../common/domain/state-machine';
import { money } from '../../../common/domain/money';
import {
  APPOINTMENT_TRANSITIONS,
  effectiveCommission,
  fitsDuration,
  invalidCommission,
  invalidInterval,
  overlaps,
  PARTNER_TRANSITIONS,
  partnerOperational,
  SETTLEMENT_TRANSITIONS,
  settlementTotals,
  splitCommission
} from './partner-rules';

const day = (value: string) => new Date(`${value}T00:00:00Z`);

describe('regras de parceiros', () => {
  it('publica só parceiros ativos dentro do contrato', () => {
    const base = {
      status: 'ACTIVE' as const,
      deletedAt: null,
      contractStartsOn: day('2026-01-01'),
      contractEndsOn: day('2026-12-31')
    };

    expect(partnerOperational(base, '2026-06-10')).toBe(true);
    expect(partnerOperational(base, '2026-12-31')).toBe(true);
    expect(partnerOperational(base, '2027-01-01')).toBe(false);
    expect(partnerOperational(base, '2025-12-31')).toBe(false);
    expect(partnerOperational({ ...base, status: 'PENDING' }, '2026-06-10')).toBe(false);
    expect(partnerOperational({ ...base, deletedAt: new Date() }, '2026-06-10')).toBe(false);
    expect(
      partnerOperational({ ...base, contractStartsOn: null, contractEndsOn: null }, '2030-01-01')
    ).toBe(true);
  });

  it('mantém encerrado como final e só paga repasse aprovado', () => {
    expect(canTransition(PARTNER_TRANSITIONS, 'ENDED', 'ACTIVE')).toBe(false);
    expect(canTransition(PARTNER_TRANSITIONS, 'PENDING', 'ACTIVE')).toBe(true);
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'DRAFT', 'PAID')).toBe(false);
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'APPROVED', 'PAID')).toBe(true);
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'PAID', 'CANCELLED')).toBe(false);
    expect(canTransition(APPOINTMENT_TRANSITIONS, 'REQUESTED', 'COMPLETED')).toBe(false);
    expect(canTransition(APPOINTMENT_TRANSITIONS, 'CONFIRMED', 'NO_SHOW')).toBe(true);
  });

  it('permite que o produto tenha comissão própria', () => {
    const partner = {
      commissionType: 'PERCENTAGE' as const,
      commissionPercentage: money('10'),
      commissionFixedAmount: null
    };

    expect(
      effectiveCommission(partner, {
        commissionTypeOverride: null,
        commissionPercentageOverride: null,
        commissionFixedOverride: null
      }).percentage?.toString()
    ).toBe('10');
    expect(
      effectiveCommission(partner, {
        commissionTypeOverride: 'FIXED',
        commissionPercentageOverride: null,
        commissionFixedOverride: money('5')
      }).type
    ).toBe('FIXED');
  });

  it('divide a comissão arredondando meio para cima e nunca acima do total', () => {
    const pct = { type: 'PERCENTAGE' as const, percentage: money('12.5'), fixedAmount: null };

    expect(splitCommission(pct, money('33.33'), 1).commission.toFixed(2)).toBe('4.17');
    expect(splitCommission(pct, money('33.33'), 1).partnerAmount.toFixed(2)).toBe('29.16');

    const fixed = { type: 'FIXED' as const, percentage: null, fixedAmount: money('15') };

    expect(splitCommission(fixed, money('100'), 3).commission.toFixed(2)).toBe('45.00');
    expect(splitCommission(fixed, money('20'), 2).commission.toFixed(2)).toBe('20.00');
    expect(splitCommission(fixed, money('20'), 2).partnerAmount.toFixed(2)).toBe('0.00');

    const none = { type: 'NONE' as const, percentage: null, fixedAmount: null };

    expect(splitCommission(none, money('50'), 1).partnerAmount.toFixed(2)).toBe('50.00');
  });

  it('valida as regras de comissão', () => {
    expect(
      invalidCommission({ type: 'PERCENTAGE', percentage: money('101'), fixedAmount: null })
    ).not.toBeNull();
    expect(
      invalidCommission({ type: 'PERCENTAGE', percentage: null, fixedAmount: null })
    ).not.toBeNull();
    expect(
      invalidCommission({ type: 'FIXED', percentage: null, fixedAmount: null })
    ).not.toBeNull();
    expect(invalidCommission({ type: 'NONE', percentage: null, fixedAmount: null })).toBeNull();
  });

  it('totaliza repasses com ajustes positivos e negativos', () => {
    const totals = settlementTotals(
      [
        { gross: money('100'), commission: money('10') },
        { gross: money('50.50'), commission: money('5.05') }
      ],
      money('-5')
    );

    expect(totals.gross.toFixed(2)).toBe('150.50');
    expect(totals.commission.toFixed(2)).toBe('15.05');
    expect(totals.net.toFixed(2)).toBe('130.45');
  });

  it('detecta intervalos sobrepostos e inválidos', () => {
    const at = (h: number) => new Date(Date.UTC(2030, 0, 1, h));
    const now = new Date(Date.UTC(2029, 0, 1));

    expect(
      overlaps({ startsAt: at(9), endsAt: at(10) }, { startsAt: at(10), endsAt: at(11) })
    ).toBe(false);
    expect(
      overlaps({ startsAt: at(9), endsAt: at(11) }, { startsAt: at(10), endsAt: at(12) })
    ).toBe(true);
    expect(invalidInterval({ startsAt: at(10), endsAt: at(9) }, now)).not.toBeNull();
    expect(invalidInterval({ startsAt: at(1), endsAt: at(20) }, now)).not.toBeNull();
    expect(invalidInterval({ startsAt: at(9), endsAt: at(10) }, at(11))).not.toBeNull();
    expect(invalidInterval({ startsAt: at(9), endsAt: at(10) }, now)).toBeNull();
    expect(fitsDuration({ startsAt: at(9), endsAt: at(10) }, 60)).toBe(true);
    expect(fitsDuration({ startsAt: at(9), endsAt: at(10) }, 61)).toBe(false);
  });
});
