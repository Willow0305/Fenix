import { decryptField, encryptField } from './data-cipher';
import { signAccessToken, verifyAccessToken } from './jwt';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password-hasher';

const SECRET = 'test-secret-with-more-than-thirty-two-characters';

describe('password hasher', () => {
  it('verifies the correct password and rejects others', async () => {
    const hash = await hashPassword('senha-correta-123');

    expect(hash.startsWith('scrypt$v1$')).toBe(true);
    await expect(verifyPassword('senha-correta-123', hash)).resolves.toBe(true);
    await expect(verifyPassword('senha-errada-123', hash)).resolves.toBe(false);
  });

  it('never matches the dummy hash or malformed values', async () => {
    await expect(verifyPassword('qualquer', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword('qualquer', 'bcrypt$abc')).resolves.toBe(false);
  });
});

describe('access token', () => {
  it('round-trips claims', () => {
    const token = signAccessToken({ sub: 'u1', sid: 's1' }, SECRET, 60, 1000);

    expect(verifyAccessToken(token, SECRET, 1010)).toMatchObject({ sub: 'u1', sid: 's1' });
  });

  it('rejects expired, tampered, foreign-secret and alg=none tokens', () => {
    const token = signAccessToken({ sub: 'u1', sid: 's1' }, SECRET, 60, 1000);
    const [header, body] = token.split('.') as [string, string, string];
    const forged = Buffer.from(
      JSON.stringify({ sub: 'admin', sid: 's1', iat: 1, exp: 9e9 })
    ).toString('base64url');
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');

    expect(verifyAccessToken(token, SECRET, 1060)).toBeNull();
    expect(
      verifyAccessToken(`${header}.${forged}.${token.split('.')[2]}`, SECRET, 1010)
    ).toBeNull();
    expect(verifyAccessToken(token, `${SECRET}-other`, 1010)).toBeNull();
    expect(verifyAccessToken(`${none}.${body}.`, SECRET, 1010)).toBeNull();
  });
});

describe('data cipher', () => {
  const key = Buffer.alloc(32, 3);

  it('encrypts with random IV and decrypts', () => {
    const a = encryptField('chave-pix@exemplo.com', key);
    const b = encryptField('chave-pix@exemplo.com', key);

    expect(a).not.toBe(b);
    expect(decryptField(a, key)).toBe('chave-pix@exemplo.com');
  });

  it('fails with a wrong key', () => {
    expect(() => decryptField(encryptField('segredo', key), Buffer.alloc(32, 4))).toThrow();
  });
});
