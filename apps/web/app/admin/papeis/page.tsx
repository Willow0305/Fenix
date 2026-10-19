'use client';

import { useState } from 'react';

import { Alert, ConfirmDialog, Loading, PageHeader } from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Role } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { useResource } from '../../../lib/use-resource';

export default function RolesPage() {
  const { can } = useAuth();
  const roles = useResource<Role[]>('/roles');
  const catalog = useResource<{ code: string; name: string }[]>('/permissions');
  const [editing, setEditing] = useState<Role | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  if (roles.loading && !roles.data) {
    return <Loading />;
  }

  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        description="Papéis agrupam permissões. O sistema verifica sempre a permissão específica de cada ação."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {roles.error ? <Alert kind="error">{roles.error}</Alert> : null}
      <div className="stack">
        {(roles.data ?? []).map((role) => (
          <section key={role.code} className="card stack">
            <div className="row">
              <h2 style={{ margin: 0 }}>{role.name}</h2>
              <span className="badge">{role.userCount} usuário(s)</span>
              <span className="spacer" />
              {can('permissions.manage') && role.code !== 'admin' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelected(role.permissions);
                    setEditing(role);
                  }}
                >
                  Editar permissões
                </button>
              ) : null}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {role.description}
            </p>
            <details>
              <summary>{role.permissions.length} permissão(ões)</summary>
              <ul>
                {role.permissions.map((code) => (
                  <li key={code}>{catalog.data?.find((p) => p.code === code)?.name ?? code}</li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={editing !== null}
        title={`Permissões — ${editing?.name ?? ''}`}
        confirmLabel="Salvar permissões"
        requireReason
        onClose={() => setEditing(null)}
        onConfirm={async (reason) => {
          await api(`/roles/${editing?.code ?? ''}/permissions`, {
            method: 'PUT',
            body: { permissions: selected, reason }
          });
          setNotice('Permissões atualizadas.');
          await roles.reload();
        }}
      >
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }} className="stack">
          {(catalog.data ?? []).map((permission) => (
            <label key={permission.code} className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(permission.code)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, permission.code]
                      : current.filter((c) => c !== permission.code)
                  )
                }
              />
              <span>
                {permission.name} <code className="muted">{permission.code}</code>
              </span>
            </label>
          ))}
        </div>
      </ConfirmDialog>
    </>
  );
}
