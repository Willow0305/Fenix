import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '../lib/auth-context';
import './globals.scss';

export const metadata: Metadata = {
  title: { default: 'Fênix Vôlei', template: '%s | Fênix Vôlei' },
  description: 'Site oficial e sistema de gestão do Time Fênix Volleyball.',
  icons: { icon: '/brand/logo-fenix.png' }
};

export const viewport: Viewport = {
  themeColor: '#0B0613'
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
