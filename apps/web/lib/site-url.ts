/** Endereço público do site (mesma variável da API, DT-022); usado em SEO e links absolutos. */
export const SITE_URL = (process.env['WEB_ORIGIN'] ?? 'http://localhost:3000').replace(/\/+$/, '');
