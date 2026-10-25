/**
 * Banco exclusivo dos testes de integração (PEN-059, DT-038).
 *
 * Os testes nunca usam o banco de desenvolvimento: o endereço vem de DATABASE_URL_TEST ou é
 * derivado de DATABASE_URL trocando o nome do banco por `<nome>_test`. O nome final precisa
 * terminar em `_test` e ser diferente do banco de desenvolvimento.
 */
function testDatabaseUrl(env = process.env) {
  const devUrl = env.DATABASE_URL;
  const explicit = env.DATABASE_URL_TEST;

  if (!explicit && !devUrl) {
    throw new Error(
      'Defina DATABASE_URL_TEST (ou DATABASE_URL) para rodar os testes de integração.'
    );
  }

  const url = new URL(explicit ?? devUrl);

  if (!explicit) {
    url.pathname = `/${url.pathname.slice(1)}_test`;
  }

  const name = url.pathname.slice(1);

  if (!/^[a-z0-9_]+_test$/i.test(name)) {
    throw new Error(`O banco de testes precisa terminar em "_test" (recebido: "${name}").`);
  }

  if (devUrl && new URL(devUrl).pathname === url.pathname && new URL(devUrl).host === url.host) {
    throw new Error('O banco de testes não pode ser o mesmo banco de desenvolvimento.');
  }

  return { url: url.toString(), name };
}

module.exports = { testDatabaseUrl };
