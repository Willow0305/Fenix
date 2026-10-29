/**
 * Política de segurança de conteúdo com nonce por requisição (R-05, DT-046). Scripts só
 * rodam com o nonce da página (`strict-dynamic` libera os que o próprio Next carrega);
 * nada de script embutido arbitrário. Estilos seguem com `unsafe-inline` por causa dos
 * atributos `style`. `unsafe-eval` e `ws:` só em desenvolvimento (recarregamento do Next).
 */
/**
 * Formulário de cartão do Mercado Pago (DT-079): o SDK é carregado pelo nosso código (o
 * `strict-dynamic` libera), os campos do cartão ficam em iframes dele e as bandeiras vêm do CDN.
 */
const MERCADO_PAGO = [
  'https://*.mercadopago.com',
  'https://*.mercadopago.com.br',
  'https://*.mercadolibre.com',
  'https://*.mercadolivre.com'
].join(' ');

export function contentSecurityPolicy(nonce: string, isProduction: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://*.mlstatic.com ${MERCADO_PAGO}`,
    "font-src 'self' data:",
    `connect-src 'self' https://api.mercadopago.com ${MERCADO_PAGO} https://*.mlstatic.com${isProduction ? '' : ' ws:'}`,
    `frame-src ${MERCADO_PAGO}`,
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
