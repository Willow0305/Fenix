/** @jest-environment node */
import { randomId } from './random-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('identificador aleatório', () => {
  it('gera UUID v4 também sem crypto.randomUUID (página sem conexão segura)', () => {
    const original = crypto.randomUUID;

    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });

    try {
      const ids = new Set(Array.from({ length: 50 }, () => randomId()));

      expect(ids.size).toBe(50);
      expect([...ids].every((id) => UUID_V4.test(id))).toBe(true);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});
