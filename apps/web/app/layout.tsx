import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { AuthProvider } from '../lib/auth-context';
import { CartProvider } from '../lib/cart-context';
import { QueryProvider } from '../components/query-provider';
import { SITE_URL } from '../lib/site-url';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import './globals.scss';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Fênix Vôlei', template: '%s | Fênix Vôlei' },
  description: 'Site oficial e sistema de gestão do Time Fênix Volleyball.',
  icons: { icon: '/brand/logo-fenix.png', apple: '/brand/logo-fenix.png' },
  manifest: '/manifest.webmanifest',
  // Imagem padrão ao compartilhar links; notícias usam a própria capa (R-12).
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Fênix Vôlei',
    images: [{ url: '/brand/logo-fenix.png', alt: 'Fênix Vôlei' }]
  },
  twitter: { card: 'summary' }
};

export const viewport: Viewport = {
  themeColor: '#0B0613'
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Ler o cabeçalho torna toda página dinâmica: cada resposta recebe o nonce da CSP (R-05).
  await headers();

  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <QueryProvider>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
