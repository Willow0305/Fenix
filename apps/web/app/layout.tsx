import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.scss';

export const metadata: Metadata = {
  description: 'Gestão segura de identidade, operação esportiva e Caixa Fênix.',
  title: 'Fênix Vôlei | Gestão segura'
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main-content">
          Pular para o conteúdo
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
