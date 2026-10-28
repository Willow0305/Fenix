'use client';

import { useState } from 'react';

import { Icon } from '../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Role } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { useResource } from '../../../lib/use-resource';

interface PermissionItem {
  code: string;
  name: string;
  area: string;
}

/** Permissões agrupadas por área, com "marcar a área inteira" (DT-078). */
function PermissionPicker({
  catalog,
  selected,
  onChange
}: {
  readonly catalog: readonly PermissionItem[];
  readonly selected: readonly string[];
  readonly onChange: (next: string[]) => void;
}) {
  const areas = [...new Set(catalog.map((p) => p.area))];

  return (
    <div className="stack permission-picker">
      {areas.map((area) => {
        const items = catalog.filter((p) => p.area === area);
        const marked = items.filter((p) => selected.includes(p.code)).length;

        return (
          <fieldset key={area} className="form-section">
            <legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={marked === items.length}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = marked > 0 && marked < items.length;
                    }
                  }}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...new Set([...selected, ...items.map((p) => p.code)])]
                        : selected.filter((code) => !items.some((p) => p.code === code))
                    )
                  }
                />
                <strong>
                  {area} ({marked}/{items.length})
                </strong>
              </label>
            </legend>
            {items.map((permission) => (
              <label key={permission.code} className="checkbox">
                <input
                  type="checkbox"
                  checked={selected.includes(permission.code)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, permission.code]
                        : selected.filter((code) => code !== permission.code)
                    )
                  }
                />
                <span>{permission.name}</span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

/**
 * Papéis e permissões (DT-078): a administração cria papéis para cada trabalho (financeiro,
 * atendimento, cadastro…), escolhe as permissões por área e dá o papel às pessoas em Usuários.
 */
export default function RolesPage() {
  const { can } = useAuth();
  const manage = can('permissions.manage');
  const roles = useResource<Role[]>('/roles');
  const catalog = useResource<PermissionItem[]>('/permissions');
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '', copyFrom: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Role | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const labelOf = (code: string) => catalog.data?.find((p) => p.code === code)?.name ?? code;

  const save = useSubmit(async () => {
    if (editing === 'new') {
      await api('/roles', {
        method: 'POST',
        body: {
          name: form.name,
          ...(form.description ? { description: form.description } : {}),
          ...(form.copyFrom ? { copyFrom: form.copyFrom } : {}),
          permissions: selected
        }
      });
      setNotice('Papel criado. Dê o papel às pessoas em Usuários.');
      setEditing(null);
      await roles.reload();
    } else if (editing) {
      if (!editing.isSystem) {
        await api(`/roles/${editing.code}`, {
          method: 'PATCH',
          body: { name: form.name, description: form.description }
        });
      }

      // Mudança de permissões pede motivo (auditoria).
      setSavingPermissions(true);
    }
  });

  function open(role: Role | 'new') {
    setForm(
      role === 'new'
        ? { name: '', description: '', copyFrom: '' }
        : { name: role.name, description: role.description ?? '', copyFrom: '' }
    );
    setSelected(role === 'new' ? [] : [...role.permissions]);
    setEditing(role);
  }

  if (roles.loading && !roles.data) {
    return <Loading />;
  }

  const copyOptions = (roles.data ?? []).filter((r) => r.code !== 'admin');

  return (
    <>
      <PageHeader
        title="Papéis e permissões"
        description="Crie um papel para cada trabalho (ex.: Financeiro, Atendimento, Cadastro), marque o que ele pode fazer e dê o papel às pessoas em Usuários. O sistema confere sempre a permissão de cada ação."
        actions={
          manage && editing === null ? (
            <button type="button" className="btn btn-primary" onClick={() => open('new')}>
              <Icon name="plus-lg" /> Novo papel
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {roles.error ? <Alert kind="error">{roles.error}</Alert> : null}

      {editing !== null && catalog.data ? (
        <form className="form card" onSubmit={(event) => void save.submit(event)}>
          <h2 className="m-0">{editing === 'new' ? 'Novo papel' : `Editar: ${editing.name}`}</h2>
          <ErrorSummary error={save.error} />
          {editing !== 'new' && editing.isSystem ? (
            <p className="muted m-0">
              Papel do sistema: o nome é fixo; só as permissões podem mudar.
            </p>
          ) : (
            <div className="form-grid">
              <TextField
                label="Nome"
                required
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Financeiro"
              />
              <TextField
                label="Descrição (opcional)"
                maxLength={500}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Cuida do Caixa e das mensalidades"
              />
              {editing === 'new' ? (
                <SelectField
                  label="Começar com as permissões de"
                  value={form.copyFrom}
                  onChange={(e) => {
                    const from = copyOptions.find((r) => r.code === e.target.value);

                    setForm({ ...form, copyFrom: e.target.value });
                    setSelected(from ? [...from.permissions] : []);
                  }}
                  options={[
                    { value: '', label: 'Nenhuma (marcar à mão)' },
                    ...copyOptions.map((r) => ({ value: r.code, label: r.name }))
                  ]}
                />
              ) : null}
            </div>
          )}
          <PermissionPicker catalog={catalog.data} selected={selected} onChange={setSelected} />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              {editing === 'new' ? 'Criar papel' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="stack">
        {(roles.data ?? []).map((role) => (
          <section key={role.code} className="card stack">
            <div className="row">
              <h2 className="m-0">{role.name}</h2>
              {role.isSystem ? <span className="badge">Sistema</span> : null}
              <span className="badge">{role.userCount} pessoa(s)</span>
              <span className="spacer" />
              {manage && role.code !== 'admin' && editing === null ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => open(role)}
                >
                  <Icon name="pencil" /> Editar
                </button>
              ) : null}
              {manage && !role.isSystem && editing === null ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRemoving(role)}
                >
                  <Icon name="trash" /> Excluir
                </button>
              ) : null}
            </div>
            {role.description ? <p className="muted m-0">{role.description}</p> : null}
            <details>
              <summary>{role.permissions.length} permissão(ões)</summary>
              <ul>
                {role.permissions.map((code) => (
                  <li key={code}>{labelOf(code)}</li>
                ))}
              </ul>
            </details>
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={savingPermissions}
        title="Salvar permissões"
        description="Quem tem este papel passa a poder (ou deixa de poder) fazer o que foi marcado. Conte o motivo para a auditoria."
        confirmLabel="Salvar"
        requireReason
        onClose={() => setSavingPermissions(false)}
        onConfirm={async (reason) => {
          if (editing && editing !== 'new') {
            await api(`/roles/${editing.code}/permissions`, {
              method: 'PUT',
              body: { permissions: selected, reason }
            });
          }

          setNotice('Papel atualizado.');
          setEditing(null);
          await roles.reload();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Excluir o papel ${removing?.name ?? ''}`}
        description={
          removing && removing.userCount > 0
            ? `${removing.userCount} pessoa(s) têm este papel. Retire o papel delas em Usuários antes de excluir.`
            : 'O papel sai da lista. A auditoria guarda o histórico.'
        }
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          await api(`/roles/${removing?.code ?? ''}`, { method: 'DELETE', body: { reason } });
          setNotice('Papel excluído.');
          await roles.reload();
        }}
      />
    </>
  );
}
