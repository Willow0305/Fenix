'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '../lib/auth-context';
import { useCart } from '../lib/cart-context';
import { BrandLogo } from './brand-logo';
import styles from './site-header.module.scss';

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export const PUBLIC_NAV: readonly NavItem[] = [
  { href: '/', label: 'Início' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/times', label: 'Times' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/seletivas', label: 'Seletivas' },
  { href: '/loja', label: 'Loja' },
  { href: '/parceiros', label: 'Parceiros' },
  { href: '/forum', label: 'Fórum' },
  { href: '/contato', label: 'Contato' }
];

export function SiteHeader({
  teamName,
  logoUrl,
  logoAlt
}: {
  readonly teamName: string;
  readonly logoUrl?: string | undefined;
  readonly logoAlt?: string | undefined;
}) {
  const { status, profile, can } = useAuth();
  const { cart } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = can('dashboard.read');

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
          <BrandLogo src={logoUrl} alt={logoAlt} size={44} />
          <span>{teamName}</span>
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="visually-hidden">Menu</span>
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>

        <nav
          id="main-nav"
          aria-label="Principal"
          className={`${styles.nav} ${open ? styles.open : ''}`}
        >
          <ul>
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.account}>
            {cart && cart.itemCount > 0 ? (
              <Link
                href="/loja/carrinho"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen(false)}
              >
                Carrinho ({cart.itemCount})
              </Link>
            ) : null}
            {status === 'authenticated' && profile ? (
              <>
                {isAdmin ? (
                  <Link
                    href="/admin"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOpen(false)}
                  >
                    Painel
                  </Link>
                ) : null}
                <Link
                  href="/minha-conta"
                  className="btn btn-primary btn-sm"
                  onClick={() => setOpen(false)}
                >
                  {profile.name.split(' ')[0]}
                </Link>
              </>
            ) : status === 'anonymous' ? (
              <Link
                href="/entrar"
                className="btn btn-primary btn-sm"
                onClick={() => setOpen(false)}
              >
                Entrar
              </Link>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
