import type { NextConfig } from 'next';

const apiInternalUrl = process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3333';

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
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  }
};

export default nextConfig;
