'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api-client';
import { useAdminSession } from '../admin-shell';
import styles from '../admin.module.scss';

interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  readonly roles: readonly string[];
  readonly emailVerifiedAt?: string;
  readonly mfaEnabled: boolean;
  readonly lastLoginAt?: string;
  readonly temporarilyBlockedUntil?: string;
}

interface RoleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export default function UsersPage() {
  const session = useAdminSession();
  const [users, setUsers] = useState<readonly UserRecord[]>([]);
  const [roles, setRoles] = useState<readonly RoleRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canCreate = session.permissions.includes('users.create');
  const canUpdate = session.permissions.includes('users.update');
  const canAssignRoles = session.permissions.includes('roles.assign');
  const canRevokeSessions = session.permissions.includes('sessions.revoke');
  const canManageMfa = session.permissions.includes('mfa.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [userResponse, roleResponse] = await Promise.all([
        apiRequest<{ readonly data: readonly UserRecord[] }>('/users?limit=100'),
        apiRequest<{ readonly data: readonly RoleRecord[] }>('/roles')
      ]);
      setUsers(userResponse.data);
      setRoles(roleResponse.data);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível carregar os usuários.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      setName('');
      setEmail('');
      setPassword('');
      setNotice('Conta pendente criada; a verificação foi enviada sem expor o código.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Não foi possível criar a conta.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(user: UserRecord, nextStatus: UserRecord['status']) {
    setError('');
    setNotice('');

    try {
      await apiRequest<void>(`/users/${user.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      setNotice(`Estado de ${user.name} atualizado para ${nextStatus}.`);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível alterar o estado.'
      );
    }
  }

  async function editName(user: UserRecord) {
    const nextName = window.prompt('Novo nome da conta:', user.name)?.trim();

    if (!nextName || nextName === user.name) {
      return;
    }

    try {
      await apiRequest<void>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName })
      });
      setNotice('Nome atualizado e auditado.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Não foi possível editar o nome.'
      );
    }
  }

  async function changeRoles(user: UserRecord, roleCodes: readonly string[]) {
    try {
      await apiRequest<void>(`/users/${user.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleCodes })
      });
      setNotice('Papéis atualizados e auditados.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError ? requestError.message : 'Não foi possível alterar papéis.'
      );
    }
  }

  async function revokeSessions(user: UserRecord) {
    if (!window.confirm(`Revogar todas as sessões ativas de ${user.name}?`)) {
      return;
    }

    try {
      await apiRequest<void>(`/users/${user.id}/revoke-sessions`, {
        method: 'POST'
      });
      setNotice('Sessões revogadas.');
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível revogar as sessões.'
      );
    }
  }

  async function resetMfa(user: UserRecord) {
    if (!window.confirm(`Redefinir o MFA de ${user.name} e revogar suas sessões?`)) {
      return;
    }

    try {
      await apiRequest<void>(`/users/${user.id}/mfa/reset`, {
        method: 'POST'
      });
      setNotice('MFA redefinido e sessões revogadas.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível redefinir o MFA.'
      );
    }
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Identidade e acesso</p>
          <h1>Usuários</h1>
          <p>Crie contas comuns, controle estados e conceda papéis de forma explícita.</p>
        </div>
      </header>

      {canCreate ? (
        <section className={styles.panel} aria-labelledby="create-user-title">
          <div className={styles.panelHeader}>
            <h2 id="create-user-title">Nova conta comum</h2>
          </div>
          <form className={styles.formGrid} onSubmit={createUser}>
            <label>
              Nome
              <input
                maxLength={160}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label>
              E-mail
              <input
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Senha inicial
              <input
                autoComplete="new-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button className={styles.primaryButton} disabled={submitting} type="submit">
              {submitting ? 'Criando…' : 'Criar usuário'}
            </button>
          </form>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="users-title">
        <div className={styles.panelHeader}>
          <h2 id="users-title">Contas cadastradas</h2>
          <button className={styles.primaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
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
        {loading ? (
          <p className={styles.empty} aria-busy="true">
            Carregando usuários…
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Estado</th>
                  <th>Segurança</th>
                  <th>Papéis</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <br />
                      <span>{user.email}</span>
                    </td>
                    <td>
                      <span className={styles.badge}>
                        {user.emailVerifiedAt ? 'E-mail verificado' : 'E-mail pendente'}
                      </span>
                      <span className={styles.badge}>
                        {user.mfaEnabled ? 'MFA ativo' : 'MFA inativo'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          user.status === 'ACTIVE' ? styles.statusActive : styles.statusBlocked
                        }`}
                      >
                        {user.status}
                      </span>
                      {user.temporarilyBlockedUntil ? (
                        <small>Bloqueio temporário ativo</small>
                      ) : null}
                    </td>
                    <td>
                      {canAssignRoles ? (
                        <select
                          aria-label={`Papéis de ${user.name}`}
                          multiple
                          onChange={(event) =>
                            void changeRoles(
                              user,
                              [...event.currentTarget.selectedOptions].map((option) => option.value)
                            )
                          }
                          value={[...user.roles]}
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.roles.map((role) => (
                          <span className={styles.badge} key={role}>
                            {role}
                          </span>
                        ))
                      )}
                    </td>
                    <td>
                      {user.lastLoginAt
                        ? new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }).format(new Date(user.lastLoginAt))
                        : 'Nunca'}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {canUpdate ? (
                          <>
                            <button onClick={() => void editName(user)} type="button">
                              Editar nome
                            </button>
                            <button
                              onClick={() =>
                                void changeStatus(
                                  user,
                                  user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
                                )
                              }
                              type="button"
                            >
                              {user.status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}
                            </button>
                          </>
                        ) : null}
                        {canRevokeSessions ? (
                          <button onClick={() => void revokeSessions(user)} type="button">
                            Revogar sessões
                          </button>
                        ) : null}
                        {canManageMfa && user.mfaEnabled ? (
                          <button onClick={() => void resetMfa(user)} type="button">
                            Redefinir MFA
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
