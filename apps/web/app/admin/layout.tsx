'use client';

import type { ReactNode } from 'react';

import { AdminShell } from '../../components/admin-shell';
import { RequireAuth } from '../../components/require-auth';

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <RequireAuth permissions={['dashboard.read']}>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
