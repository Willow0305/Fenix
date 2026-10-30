import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

const apiInternalUrl = process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3333';
const isProduction = process.env['NODE_ENV'] === 'production';

// A CSP é gerada por requisição, com nonce, em `proxy.ts` (R-05, DT-046).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : [])
];

/**
 * Só em desenvolvimento: abrir o site no celular pela mesma rede (http://IP-do-computador:3000).
 * O Next bloqueia os scripts de desenvolvimento vindos de outro endereço; aqui liberamos os
 * endereços IPv4 de rede deste computador e os de `DEV_ALLOWED_ORIGINS` (separados por vírgula).
 */
function localNetworkHosts(): string[] {
  const fromEnv = (process.env['DEV_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const own = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net !== undefined && net.family === 'IPv4' && !net.internal)
    .map((net) => net?.address ?? '');

  return [...new Set([...own, ...fromEnv])].filter(Boolean);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isProduction ? {} : { allowedDevOrigins: localNetworkHosts() }),
  // Pasta de build separada para os testes de ponta a ponta (`.next-e2e`), sem disputar com o `next dev`.
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  poweredByHeader: false,
  // Imagem Docker: servidor enxuto com só o necessário (DT-053). Local segue com `next start`.
  ...(process.env['NEXT_OUTPUT'] === 'standalone'
    ? { output: 'standalone' as const, outputFileTracingRoot: resolve(process.cwd(), '../..') }
    : {}),
  // Origem única (DT-022): o navegador chama /api/v1 no próprio domínio da web.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
