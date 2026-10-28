import { money } from '../../../common/domain/money';
import {
  addressLine,
  addressProblems,
  cleanDeliveryCode,
  cleanPostalCode,
  deliveryFee,
  firstName,
  newDeliveryCode,
  normalizeNeighborhood,
  notReceivedDeadline,
  parseNeighborhoods,
  provesDelivery,
  strongerProof
} from './delivery';

describe('entrega em casa (DT-075)', () => {
  it('compara bairro sem acento, caixa ou espaço extra', () => {
    expect(normalizeNeighborhood('  Jardim   Europa ')).toBe('jardim europa');
    expect(normalizeNeighborhood('São Francisco')).toBe(normalizeNeighborhood('sao francisco'));
    expect(normalizeNeighborhood('Conj. Tucumã I')).toBe('conj tucuma i');
  });

  it('lê a lista de bairros por linha ou vírgula, sem repetidos', () => {
    expect(parseNeighborhoods(['Centro\nBosque, Base', 'centro', ' ', 'Bosque'])).toEqual([
      'Centro',
      'Bosque',
      'Base'
    ]);
  });

  it('cobra a taxa da região, salvo frete grátis a partir do mínimo', () => {
    const zoneFee = money('12');

    expect(
      deliveryFee({ zoneFee, productsTotal: money('199.99'), freeMinimum: money('200') }).toFixed(2)
    ).toBe('12.00');
    expect(
      deliveryFee({ zoneFee, productsTotal: money('200'), freeMinimum: money('200') }).toFixed(2)
    ).toBe('0.00');
    expect(
      deliveryFee({ zoneFee, productsTotal: money('5000'), freeMinimum: null }).toFixed(2)
    ).toBe('12.00');
  });

  it('confere CEP, rua e número', () => {
    expect(cleanPostalCode('69.900-000')).toBe('69900000');
    expect(cleanPostalCode('6990')).toBeNull();
    expect(
      addressProblems({ postalCode: '123', street: 'R', number: ' ' }).map((p) => p.field)
    ).toEqual(['postalCode', 'street', 'number']);
    expect(addressProblems({ postalCode: '69900-000', street: 'Rua A', number: 's/n' })).toEqual(
      []
    );
  });

  it('monta a linha do endereço', () => {
    expect(
      addressLine({
        postalCode: '69900000',
        street: 'Rua das Flores',
        number: '10',
        complement: 'casa 2',
        neighborhood: 'Centro',
        city: 'Rio Branco',
        state: 'AC',
        reference: null,
        phone: null,
        zoneName: 'Centro',
        leadDays: 1
      })
    ).toBe('Rua das Flores, 10, casa 2 — Centro, Rio Branco/AC');
  });
});

describe('comprovante de entrega (DT-075, etapa 2)', () => {
  const delivered = {
    fulfillment: 'DELIVERY',
    status: 'DELIVERED',
    deliveredAt: new Date('2026-10-28T12:00:00Z'),
    deliveryConfirmedAt: null,
    deliveryProofKind: 'STAFF_ONLY' as const,
    notReceivedAt: null
  };

  it('guarda a prova mais forte', () => {
    expect(strongerProof(null, 'STAFF_ONLY')).toBe('STAFF_ONLY');
    expect(strongerProof('STAFF_ONLY', 'PHOTO')).toBe('PHOTO');
    expect(strongerProof('CODE', 'BUYER_RECEIPT')).toBe('CODE');
    expect(provesDelivery('PHOTO')).toBe(true);
    expect(provesDelivery('STAFF_ONLY')).toBe(false);
    expect(provesDelivery(null)).toBe(false);
  });

  it('gera e limpa o código de 4 dígitos', () => {
    expect(newDeliveryCode(() => 7)).toBe('0007');
    expect(newDeliveryCode(() => 9999)).toBe('9999');
    expect(cleanDeliveryCode(' 48-21 ')).toBe('4821');
    expect(cleanDeliveryCode('482')).toBeNull();
  });

  it('mostra só o primeiro nome do entregador', () => {
    expect(firstName('  João  da Silva')).toBe('João');
    expect(firstName(null)).toBeNull();
    expect(firstName('  ')).toBeNull();
  });

  it('"Não recebi" só com prova fraca e em até 3 dias', () => {
    const now = new Date('2026-10-30T12:00:00Z');

    expect(notReceivedDeadline(delivered, now)?.toISOString()).toBe('2026-10-31T12:00:00.000Z');
    expect(notReceivedDeadline(delivered, new Date('2026-10-31T12:00:01Z'))).toBeNull();
    expect(notReceivedDeadline({ ...delivered, deliveryProofKind: 'CODE' }, now)).toBeNull();
    expect(notReceivedDeadline({ ...delivered, deliveryConfirmedAt: new Date() }, now)).toBeNull();
    expect(notReceivedDeadline({ ...delivered, fulfillment: 'PICKUP' }, now)).toBeNull();
    expect(notReceivedDeadline({ ...delivered, notReceivedAt: new Date() }, now)).toBeNull();
  });
});
