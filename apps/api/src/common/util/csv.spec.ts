import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('escapes separators and quotes', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'diz "oi"']])).toBe('a;b\n"x;y";"diz ""oi"""');
  });

  it('neutralizes spreadsheet formulas in text but keeps numbers', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+5511999')).toBe("'+5511999");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-15.5)).toBe('-15.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell('Camisa G')).toBe('Camisa G');
  });
});
