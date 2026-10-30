import { MAX_CROP_SIDE, outputSize } from './crop-image';

describe('recorte de foto (DT-081)', () => {
  it('mantém o tamanho do corte quando cabe no limite', () => {
    expect(outputSize({ x: 0, y: 0, width: 1200, height: 800 })).toEqual({
      width: 1200,
      height: 800
    });
  });

  it('reduz proporcionalmente quando o corte passa do limite', () => {
    expect(outputSize({ x: 10, y: 20, width: 4800, height: 3200 })).toEqual({
      width: MAX_CROP_SIDE,
      height: 1600
    });
  });
});
