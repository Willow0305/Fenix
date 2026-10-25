const assert = require('node:assert/strict');
const { test } = require('node:test');

const { testDatabaseUrl } = require('./test-database.cjs');

const DEV = 'postgresql://fenix:x@127.0.0.1:5433/fenix?schema=public';

test('deriva o banco de testes com sufixo _test', () => {
  const { url, name } = testDatabaseUrl({ DATABASE_URL: DEV });

  assert.equal(name, 'fenix_test');
  assert.match(url, /\/fenix_test\?schema=public$/);
});

test('recusa usar o banco de desenvolvimento', () => {
  assert.throws(
    () => testDatabaseUrl({ DATABASE_URL: DEV, DATABASE_URL_TEST: DEV }),
    /terminar em "_test"/
  );
});

test('recusa nome sem sufixo _test ou com caracteres inválidos', () => {
  assert.throws(() =>
    testDatabaseUrl({ DATABASE_URL: DEV, DATABASE_URL_TEST: DEV.replace('/fenix?', '/outro?') })
  );
  assert.throws(() =>
    testDatabaseUrl({ DATABASE_URL: DEV, DATABASE_URL_TEST: DEV.replace('/fenix?', '/a;b_test?') })
  );
});

test('exige alguma URL configurada', () => {
  assert.throws(() => testDatabaseUrl({}), /DATABASE_URL_TEST/);
});
