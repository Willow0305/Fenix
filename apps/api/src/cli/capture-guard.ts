/** Só no computador de desenvolvimento: nunca em produção nem com endereço público. */
export function assertLocalOnly(env: NodeJS.ProcessEnv): void {
  const origin = env['WEB_ORIGIN'] ?? 'http://localhost:3000';
  const host = new URL(origin).hostname;

  if (env['NODE_ENV'] === 'production' || !['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('A conta de capturas só pode ser criada no ambiente local.');
  }
}
