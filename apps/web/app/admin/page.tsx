'use client';

import Link from 'next/link';

import { ADMIN_NAV } from '../../components/admin-shell';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth-context';
import { DashboardIndicators } from './dashboard-indicators';

export default function AdminHomePage() {
  const { profile, can } = useAuth();

  return (
    <>
      <PageHeader title="Painel" description={`Bem-vindo(a), ${profile?.name ?? ''}.`} />
      <DashboardIndicators />
      <section className="stack" aria-labelledby="atalhos">
        <h2 id="atalhos">Atalhos</h2>
        <div className="stat-grid">
          {ADMIN_NAV.slice(1).map((group) => {
            const links = group.links.filter((link) => can(link.permission));

            return links.length === 0 ? null : (
              <div key={group.label} className="card">
                <strong>{group.label}</strong>
                <ul>
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
