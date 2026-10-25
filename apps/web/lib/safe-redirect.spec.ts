import { safeInternalPath } from './safe-redirect';

describe('safeInternalPath', () => {
  it('keeps internal paths with query and hash', () => {
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
  ])('falls back for %p', (value) => {
    expect(safeInternalPath(value)).toBe('/minha-conta');
  });
});
