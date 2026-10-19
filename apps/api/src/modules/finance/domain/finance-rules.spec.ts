import { money, parseMoney, round2, toMoneyString } from '../../../common/domain/money';
import { civilDateOf, endOfDayExclusive, startOfDayInZone } from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import {
  balanceOf,
  dueDateFor,
  effectiveFeeStatus,
  effectiveObligationStatus,
  feeStatusAfterPayments,
  feeTotal,
  isInClosedPeriod,
  periodsIntersect,
  planCoversMonth,
  remainingAmount
} from './finance-rules';

describe('money', () => {
  it('parses decimal strings without floating point errors', () => {
    expect(parseMoney('0.1').plus(parseMoney('0.2')).toFixed(2)).toBe('0.30');
    expect(toMoneyString(parseMoney('89.9'))).toBe('89.90');
  });

  it('rejects invalid, negative, zero and over-precise values', () => {
    for (const value of ['-1', '0', '1.234', 'abc', '1e3', '10,50']) {
      expect(() => parseMoney(value)).toThrow(AppError);
    }

    expect(parseMoney('0', 'amount', { allowZero: true }).toFixed(2)).toBe('0.00');
  });

  it('rounds half-up to cents', () => {
    expect(round2(money('10.005')).toFixed(2)).toBe('10.01');
    expect(round2(money('10.004')).toFixed(2)).toBe('10.00');
  });
});

describe('monthly fees', () => {
  it('clamps the due day to the month length', () => {
    expect(dueDateFor('2026-02-01', 31)).toBe('2026-02-28');
    expect(dueDateFor('2028-02-01', 30)).toBe('2028-02-29');
    expect(dueDateFor('2026-07-01', 10)).toBe('2026-07-10');
  });

  it('computes total with discount and additional', () => {
    expect(feeTotal(money('100'), money('15.50'), money('0')).toFixed(2)).toBe('84.50');
  });

  it('derives status from confirmed payments', () => {
    expect(feeStatusAfterPayments(money('100'), money('0'))).toBe('OPEN');
    expect(feeStatusAfterPayments(money('100'), money('40'))).toBe('PARTIALLY_PAID');
    expect(feeStatusAfterPayments(money('100'), money('100'))).toBe('PAID');
    expect(feeStatusAfterPayments(money('0'), money('0'))).toBe('PAID');
  });

  it('derives overdue from the due date only for unpaid fees', () => {
    expect(effectiveFeeStatus('OPEN', '2026-10-10', '2026-10-11')).toBe('OVERDUE');
    expect(effectiveFeeStatus('PARTIALLY_PAID', '2026-10-10', '2026-10-11')).toBe('OVERDUE');
    expect(effectiveFeeStatus('OPEN', '2026-10-10', '2026-10-10')).toBe('OPEN');
    expect(effectiveFeeStatus('PAID', '2026-10-10', '2026-12-01')).toBe('PAID');
  });

  it('checks plan coverage of a reference month', () => {
    expect(planCoversMonth({ startsOn: '2026-03-15', endsOn: null }, '2026-03-01')).toBe(true);
    expect(planCoversMonth({ startsOn: '2026-04-01', endsOn: null }, '2026-03-01')).toBe(false);
    expect(planCoversMonth({ startsOn: '2026-01-01', endsOn: '2026-02-28' }, '2026-03-01')).toBe(
      false
    );
  });

  it('never returns a negative remaining amount', () => {
    expect(remainingAmount(money('100'), money('120')).toFixed(2)).toBe('0.00');
  });
});

describe('cash', () => {
  it('derives balance from confirmed movements', () => {
    expect(
      balanceOf([
        { direction: 'INCOME', amount: money('150.00') },
        { direction: 'EXPENSE', amount: money('49.99') },
        { direction: 'INCOME', amount: money('0.01') }
      ]).toFixed(2)
    ).toBe('100.02');
  });

  it('locks dates inside closed periods', () => {
    const closed = [{ periodStart: '2026-09-01', periodEnd: '2026-09-30' }];

    expect(isInClosedPeriod('2026-09-30', closed)).toBe(true);
    expect(isInClosedPeriod('2026-10-01', closed)).toBe(false);
    expect(
      periodsIntersect(closed[0]!, { periodStart: '2026-09-15', periodEnd: '2026-10-15' })
    ).toBe(true);
  });

  it('derives overdue obligations', () => {
    expect(effectiveObligationStatus('OPEN', '2026-10-01', '2026-10-02')).toBe('OVERDUE');
    expect(effectiveObligationStatus('SETTLED', '2026-10-01', '2026-10-02')).toBe('SETTLED');
  });
});

describe('time zone helpers', () => {
  it('maps civil days in Rio Branco (UTC-5) to UTC instants', () => {
    expect(startOfDayInZone('2026-10-18').toISOString()).toBe('2026-10-18T05:00:00.000Z');
    expect(endOfDayExclusive('2026-10-31').toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(civilDateOf(new Date('2026-10-19T03:00:00Z'))).toBe('2026-10-18');
  });

  it('handles zones with daylight saving time', () => {
    expect(startOfDayInZone('2026-07-01', 'America/New_York').toISOString()).toBe(
      '2026-07-01T04:00:00.000Z'
    );
    expect(startOfDayInZone('2026-01-15', 'America/New_York').toISOString()).toBe(
      '2026-01-15T05:00:00.000Z'
    );
  });
});
