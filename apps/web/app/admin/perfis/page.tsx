'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api-client';
import { useAdminSession } from '../admin-shell';
import styles from '../admin.module.scss';

interface PermissionRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

interface RoleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly permissions: readonly string[];
}

export default function RolesPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('permissions.manage');
  const [roles, setRoles] = useState<readonly RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<readonly PermissionRecord[]>([]);
  const [selection, setSelection] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');

    try {
      const roleResponse = await apiRequest<{ readonly data: readonly RoleRecord[] }>('/roles');
      const permissionResponse = canManage
        ? await apiRequest<{ readonly data: readonly PermissionRecord[] }>('/permissions')
        : { data: [] };
      setRoles(roleResponse.data);
      setPermissions(permissionResponse.data);
      setSelection(
        Object.fromEntries(roleResponse.data.map((role) => [role.id, [...role.permissions]]))
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível carregar os perfis.'
      );
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(roleId: string, permissionCode: string) {
    setSelection((current) => {
      const codes = current[roleId] ?? [];

      return {
        ...current,
        [roleId]: codes.includes(permissionCode)
          ? codes.filter((code) => code !== permissionCode)
          : [...codes, permissionCode]
      };
    });
  }

  async function save(role: RoleRecord) {
    setError('');
    setNotice('');

    try {
      await apiRequest<void>(`/roles/${role.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionCodes: selection[role.id] ?? [] })
      });
      setNotice(`Permissões de ${role.name} atualizadas e auditadas.`);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível salvar as permissões.'
      );
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Controle de acesso</p>
          <h1>Perfis e permissões</h1>
          <p>
            Papéis agrupam capacidades atômicas. O servidor continua sendo a autoridade de acesso.
          </p>
        </div>
      </header>

      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.roleGrid} aria-label="Papéis da Fase 1">
        {roles.map((role) => {
          const protectedRole = role.code === 'ADMIN';

          return (
            <article className={styles.roleCard} key={role.id}>
              <h2>{role.name}</h2>
              <p>{role.description}</p>
              {canManage ? (
                <div className={styles.checks}>
                  {permissions.map((permission) => (
                    <label key={permission.id}>
                      <input
                        checked={(selection[role.id] ?? []).includes(permission.code)}
                        disabled={protectedRole}
                        onChange={() => toggle(role.id, permission.code)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{permission.code}</strong>
                        <br />
                        {permission.name}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  {role.permissions.map((permission) => (
                    <span className={styles.badge} key={permission}>
                      {permission}
                    </span>
                  ))}
                </div>
              )}
              {canManage && !protectedRole ? (
                <button
                  className={styles.primaryButton}
                  onClick={() => void save(role)}
                  type="button"
                >
                  Salvar permissões
                </button>
              ) : null}
              {protectedRole ? (
                <p className={styles.notice}>Papel protegido para evitar perda da administração.</p>
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}
