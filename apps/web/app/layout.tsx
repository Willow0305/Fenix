import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.scss';

export const metadata: Metadata = {
  description: 'Validação da base técnica do sistema Fênix Vôlei.',
  title: 'Fênix Vôlei | Base técnica'
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
