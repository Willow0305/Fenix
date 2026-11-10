import { BOARD_POSITION_MAX, normalizeBoardPosition } from './board-position';

describe('cargo na diretoria (DT-102)', () => {
  it('limpa espaços e trata vazio como sem cargo', () => {
    expect(normalizeBoardPosition('  Tesoureira   do clube ')).toBe('Tesoureira do clube');
    expect(normalizeBoardPosition('   ')).toBeNull();
    expect(normalizeBoardPosition(null)).toBeNull();
  });

  it('corta no tamanho máximo', () => {
    expect(normalizeBoardPosition('A'.repeat(100))).toHaveLength(BOARD_POSITION_MAX);
  });
});
