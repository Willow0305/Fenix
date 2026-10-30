import { plural } from './plural';

describe('plural', () => {
  it('escreve singular e plural por extenso', () => {
    expect(plural(1, 'unidade', 'unidades')).toBe('1 unidade');
    expect(plural(0, 'unidade', 'unidades')).toBe('0 unidades');
    expect(plural(1500, 'unidade disponível', 'unidades disponíveis')).toBe(
      '1.500 unidades disponíveis'
    );
  });
});
