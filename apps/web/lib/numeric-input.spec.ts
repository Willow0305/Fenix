import { decimalDisplay, decimalInput, digitsOnly, signedDigits } from './numeric-input';

describe('campos numéricos', () => {
  it('inteiro só aceita dígitos, mesmo colando texto', () => {
    expect(digitsOnly('1e5')).toBe('15');
    expect(digitsOnly('-3+2')).toBe('32');
    expect(digitsOnly('12 unidades')).toBe('12');
  });

  it('inteiro com sinal aceita "-" só no início (ajuste de estoque)', () => {
    expect(signedDigits('-3')).toBe('-3');
    expect(signedDigits('-')).toBe('-');
    expect(signedDigits('5-2')).toBe('52');
    expect(signedDigits('--4a')).toBe('-4');
  });

  it('valor aceita vírgula ou ponto e entrega ponto com até 2 casas', () => {
    expect(decimalInput('89,90')).toBe('89.90');
    expect(decimalInput('89.905')).toBe('89.90');
    expect(decimalInput('R$ 1.234,50')).toBe('1234.50');
    expect(decimalInput('1,2,3')).toBe('1.23');
    expect(decimalInput('abc')).toBe('');
    expect(decimalInput('10,')).toBe('10.');
  });

  it('mostra vírgula para a pessoa', () => {
    expect(decimalDisplay('89.90')).toBe('89,90');
  });
});
