import { money } from '../../../common/domain/money';
import {
  addressLine,
  addressProblems,
  cleanPostalCode,
  deliveryFee,
  normalizeNeighborhood,
  parseNeighborhoods
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
