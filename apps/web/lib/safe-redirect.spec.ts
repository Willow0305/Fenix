import { safeInternalPath } from './safe-redirect';

describe('safeInternalPath', () => {
  it('mantém caminhos internos com parâmetros e âncora', () => {
    expect(safeInternalPath('/admin/caixa?mes=10#topo')).toBe('/admin/caixa?mes=10#topo');
  });

  it.each([
    [null],
    [''],
    ['https://malicioso.example'],
    ['//malicioso.example'],
    ['/\\malicioso.example'],
    ['/\t/malicioso.example'],
    ['javascript:alert(1)']
  ])('volta para Minha conta com %p', (value) => {
    expect(safeInternalPath(value)).toBe('/minha-conta');
  });
});
