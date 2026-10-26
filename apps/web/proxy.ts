import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy } from './lib/csp';

/** Gera um nonce por requisição e aplica a CSP na requisição (para o Next) e na resposta. */
export function proxy(request: NextRequest): NextResponse {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  const nonce = btoa(String.fromCharCode(...bytes));
  const policy = contentSecurityPolicy(nonce, process.env['NODE_ENV'] === 'production');
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', policy);

  return response;
}

export const config = {
  matcher: [
    {
      // API (repassada à Nest, que tem cabeçalhos próprios) e arquivos estáticos ficam fora.
      source: '/((?!api|_next/static|_next/image|brand/|favicon.ico|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
};
