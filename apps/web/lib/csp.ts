/**
 * Política de segurança de conteúdo com nonce por requisição (R-05, DT-046). Scripts só
 * rodam com o nonce da página (`strict-dynamic` libera os que o próprio Next carrega);
 * nada de script embutido arbitrário. Estilos seguem com `unsafe-inline` por causa dos
 * atributos `style`. `unsafe-eval` e `ws:` só em desenvolvimento (recarregamento do Next).
 */
export function contentSecurityPolicy(nonce: string, isProduction: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self'${isProduction ? '' : ' ws:'}`,
    // Service worker do app instalável (DT-059): só do próprio site.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : [])
  ].join('; ');
}
