'use client';

import Link from 'next/link';

import { ADMIN_NAV } from '../../components/admin-shell';
import { Icon } from '../../components/icon';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth-context';
import { DashboardIndicators } from './dashboard-indicators';

export default function AdminHomePage() {
  const { profile, can } = useAuth();

  return (
    <>
      <PageHeader title="Painel" description={`Olá, ${profile?.name.split(' ')[0] ?? ''}.`} />
      <DashboardIndicators />
      <section className="stack" aria-labelledby="atalhos">
        <h2 id="atalhos">Atalhos</h2>
        <div className="shortcut-grid">
          {ADMIN_NAV.slice(1).map((group) => {
            const links = group.links.filter((link) => can(link.permission));

            return links.length === 0 ? null : (
              <div key={group.label} className="card shortcut-group">
                <h3>{group.label}</h3>
                <ul className="list-plain">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>
                        <Icon name={link.icon} /> {link.label}
                      </Link>
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
