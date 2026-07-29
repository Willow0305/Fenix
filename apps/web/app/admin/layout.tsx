import type { ReactNode } from 'react';

import { AdminShell } from './admin-shell';

interface AdminLayoutProps {
  readonly children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}
