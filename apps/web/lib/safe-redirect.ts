const PROBE_ORIGIN = 'https://fenix.invalid';

/**
 * Aceita apenas caminhos do próprio site como destino pós-login. Barra invertida e
 * caracteres de controle são recusados porque o navegador os normaliza para `//`,
 * transformando o caminho em outro domínio (redirecionamento aberto).
 */
export function safeInternalPath(value: string | null, fallback = '/minha-conta'): string {
  if (
    value === null ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    // eslint-disable-next-line no-control-regex -- caracteres de controle são justamente o alvo
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  const url = new URL(value, PROBE_ORIGIN);

  return url.origin === PROBE_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : fallback;
}
