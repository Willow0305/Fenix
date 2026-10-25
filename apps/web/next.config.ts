import type { NextConfig } from 'next';

const apiInternalUrl = process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3333';
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * CSP sem nonces (o site não carrega recursos de terceiros). `unsafe-eval` e `ws:` só
 * existem em desenvolvimento, para o recarregamento do Next.js.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? '' : ' ws:'}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ['upgrade-insecure-requests'] : [])
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : [])
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fenix/ui'],
  poweredByHeader: false,
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
