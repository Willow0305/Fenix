import { watchedOrders } from '../realtime.module';
import { signWatchKey, verifyWatchKey, watchSecret } from './watch-key';

const secret = watchSecret(Buffer.alloc(32, 7));
const order = '3f2b8c1e-0000-4000-8000-000000000001';
const other = '3f2b8c1e-0000-4000-8000-000000000002';

describe('chave para acompanhar o pedido sem login (DT-116)', () => {
  it('a chave assinada abre só o próprio pedido', () => {
    const key = signWatchKey(secret, order);

    expect(verifyWatchKey(secret, key)).toBe(order);
    expect(verifyWatchKey(secret, key.replace(order, other))).toBeNull();
  });

  it('recusa chave de outra chave de dados, adulterada ou malformada', () => {
    const foreign = signWatchKey(watchSecret(Buffer.alloc(32, 9)), order);

    expect(verifyWatchKey(secret, foreign)).toBeNull();
    expect(verifyWatchKey(secret, `${order}.`)).toBeNull();
    expect(verifyWatchKey(secret, `${order}.abc.def`)).toBeNull();
    expect(verifyWatchKey(secret, 'nao-e-uuid.abc')).toBeNull();
    expect(verifyWatchKey(secret, '')).toBeNull();
  });

  it('aceita até 5 chaves e descarta as inválidas sem erro', () => {
    const keys = Array.from({ length: 7 }, (_, i) =>
      signWatchKey(secret, `3f2b8c1e-0000-4000-8000-00000000000${i}`)
    );

    expect(watchedOrders(secret, keys.join(',')).size).toBe(5);
    expect([...watchedOrders(secret, `lixo,${signWatchKey(secret, order)}`)]).toEqual([order]);
    expect(watchedOrders(secret, ['a', 'b']).size).toBe(0);
    expect(watchedOrders(secret, undefined).size).toBe(0);
  });
});
