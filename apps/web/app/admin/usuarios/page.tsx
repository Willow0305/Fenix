'use client';

import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  Pagination,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { AdminUser, Page, Role } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

const STATUS_LABEL: Record<AdminUser['status'], string> = {
  ACTIVE: 'Ativo',
  PENDING: 'Pendente',
  INACTIVE: 'Inativo',
  BLOCKED: 'Bloqueado'
};

const STATUS_BADGE: Record<AdminUser['status'], string> = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  INACTIVE: '',
  BLOCKED: 'badge-danger'
};

type Dialog =
  | { kind: 'roles'; user: AdminUser }
  | { kind: 'status'; user: AdminUser }
  | { kind: 'sessions'; user: AdminUser }
  | { kind: 'mfa'; user: AdminUser }
  | null;

export default function UsersPage() {
  const { can, profile } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const users = useResource<Page<AdminUser>>('/users', { page, pageSize: 20, search: term });
  const roles = useResource<Role[]>('/roles');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [status, setStatus] = useState<AdminUser['status']>('ACTIVE');
  const [notice, setNotice] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'user' });
  const create = useSubmit(async () => {
    await api('/users', {
      method: 'POST',
      body: { name: newUser.name, email: newUser.email, roles: [newUser.role] }
    });
    setNewUser({ name: '', email: '', role: 'user' });
    create.setMessage(
      'Usuário criado. Um link para definir a senha foi enviado ao e-mail informado.'
    );
    await users.reload();
  });
  const roleOptions = (roles.data ?? []).map((role) => ({ value: role.code, label: role.name }));

  return (
    <>
      <PageHeader title="Usuários" description="Contas, papéis e acesso ao sistema." />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <form
        className="row"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setTerm(search);
        }}
      >
        <input
          aria-label="Buscar por nome ou e-mail"
          maxLength={120}
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            minHeight: 40,
            padding: '0 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--color-border)'
          }}
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          Buscar
        </button>
      </form>

      {users.error ? <Alert kind="error">{users.error}</Alert> : null}
      {users.loading && !users.data ? <Loading /> : null}
      {users.data && users.data.data.length === 0 ? (
        <Empty>Nenhum usuário encontrado.</Empty>
      ) : null}
      {users.data && users.data.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Papéis</th>
                <th scope="col">Status</th>
                <th scope="col">Último acesso</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.data.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <br />
                    <span className="muted">{user.email}</span>
                  </td>
                  <td>
                    {user.roles.map((role) => (
                      <span key={role} className="badge badge-brand" style={{ marginRight: 4 }}>
                        {roles.data?.find((r) => r.code === role)?.name ?? role}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[user.status]}`}>
                      {STATUS_LABEL[user.status]}
                    </span>
                    {user.mfaEnabled ? (
                      <span className="badge badge-success" style={{ marginLeft: 4 }}>
                        2 etapas
                      </span>
                    ) : null}
                  </td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    {user.id === profile?.id ? (
                      <span className="muted">Sua conta</span>
                    ) : (
                      <div className="row">
                        {can('roles.assign') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedRoles(user.roles);
                              setDialog({ kind: 'roles', user });
                            }}
                          >
                            Papéis
                          </button>
                        ) : null}
                        {can('users.update') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setStatus(user.status);
                              setDialog({ kind: 'status', user });
                            }}
                          >
                            Status
                          </button>
                        ) : null}
                        {can('sessions.revoke') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDialog({ kind: 'sessions', user })}
                          >
                            Encerrar sessões
                          </button>
                        ) : null}
                        {user.mfaEnabled &&
                        user.id !== profile?.id &&
                        can('users.update', 'sessions.revoke') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDialog({ kind: 'mfa', user })}
                          >
                            Redefinir 2 etapas
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {users.data ? <Pagination {...users.data.meta} onChange={setPage} /> : null}

      {can('users.create', 'roles.assign') ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <h2>Novo usuário</h2>
          {create.message ? <Alert kind="success">{create.message}</Alert> : null}
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Nome"
              maxLength={160}
              required
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <TextField
              label="E-mail"
              maxLength={180}
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <SelectField
              label="Papel"
              options={roleOptions}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Criar usuário
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'roles'}
        title={`Papéis de ${dialog?.user.name ?? ''}`}
        confirmLabel="Salvar papéis"
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/users/${dialog?.user.id ?? ''}/roles`, {
            method: 'PUT',
            body: { roles: selectedRoles, reason }
          });
          setNotice('Papéis atualizados.');
          await users.reload();
        }}
      >
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend className="visually-hidden">Papéis</legend>
          {(roles.data ?? []).map((role) => (
            <label key={role.code} className="checkbox">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.code)}
                onChange={(e) =>
                  setSelectedRoles((current) =>
                    e.target.checked
                      ? [...current, role.code]
                      : current.filter((code) => code !== role.code)
                  )
                }
              />
              <span>
                <strong>{role.name}</strong> — {role.description}
              </span>
            </label>
          ))}
        </fieldset>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'status'}
        title={`Status de ${dialog?.user.name ?? ''}`}
        description="Bloquear ou inativar encerra imediatamente todas as sessões da conta."
        confirmLabel="Alterar status"
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/users/${dialog?.user.id ?? ''}/status`, {
            method: 'PUT',
            body: { status, reason }
          });
          setNotice('Status atualizado.');
          await users.reload();
        }}
      >
        <SelectField
          label="Novo status"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminUser['status'])}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'sessions'}
        title="Encerrar todas as sessões"
        description={`${dialog?.user.name ?? ''} precisará entrar novamente em todos os dispositivos.`}
        confirmLabel="Encerrar sessões"
        danger
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          const result = await api<{ revoked: number }>(
            `/users/${dialog?.user.id ?? ''}/sessions/revoke`,
            {
              method: 'POST',
              body: { reason }
            }
          );
          setNotice(`${result.revoked} sessão(ões) encerrada(s).`);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'mfa'}
        title="Redefinir verificação em duas etapas"
        description={`Use só se ${dialog?.user.name ?? ''} perdeu o celular e os códigos de recuperação. A pessoa sai de todos os dispositivos e precisa ativar a verificação de novo.`}
        confirmLabel="Redefinir"
        danger
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/users/${dialog?.user.id ?? ''}/mfa/reset`, {
            method: 'POST',
            body: { reason }
          });
          setNotice('Verificação em duas etapas redefinida.');
          await users.reload();
        }}
      />
    </>
  );
}
