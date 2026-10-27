'use client';

import { FIELD_LIMITS } from '@fenix/validation';
import { type ReactNode, useState } from 'react';

import { api } from '../lib/api-client';
import { Icon } from './icon';
import { Alert, ConfirmDialog, ErrorSummary, TextArea, TextField, useSubmit } from './ui';

export interface ManagedCategory {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly isActive: boolean;
  /** Ex.: "12 tópicos", "12–17 anos", "Despesa". */
  readonly detail?: string | undefined;
  /** Categoria do sistema: não pode ser inativada nem excluída. */
  readonly locked?: boolean;
}

/**
 * Lista de categorias com editar, ativar/inativar e excluir (docs/29 COR-022). Usada por
 * todos os tipos (equipes, loja, notícias, fórum, financeiro). A exclusão só funciona sem
 * uso; em uso, a API explica onde e o diálogo mostra a mensagem.
 */
export function CategoryManager<T extends ManagedCategory>({
  items,
  endpoint,
  manage,
  withDescription = true,
  noun = 'categoria',
  emptyText = 'Nenhuma categoria cadastrada.',
  rowExtra,
  deleteHint,
  onChanged
}: {
  readonly items: readonly T[];
  /** Base REST, ex.: `/store/categories` (PATCH e DELETE em `${endpoint}/:id`). */
  readonly endpoint: string;
  readonly manage: boolean;
  readonly withDescription?: boolean;
  readonly noun?: string;
  readonly emptyText?: string;
  /** Controles extras por linha (ex.: visibilidade do fórum). */
  readonly rowExtra?: (item: T) => ReactNode;
  /** Texto do diálogo de exclusão quando a regra do cadastro é outra (ex.: contas). */
  readonly deleteHint?: string;
  readonly onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleting, setDeleting] = useState<T | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit(async () => {
    if (!editing) {
      return;
    }

    await api(`${endpoint}/${editing.id}`, {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        ...(withDescription ? { description: form.description.trim() } : {})
      }
    });
    setEditing(null);
    setNotice(`${capitalize(noun)} atualizada.`);
    await onChanged();
  });

  async function toggle(item: T) {
    await api(`${endpoint}/${item.id}`, { method: 'PATCH', body: { isActive: !item.isActive } });
    await onChanged();
  }

  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="stack" style={{ gap: '0.5rem' }}>
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <ul className="category-list">
        {items.map((item) => (
          <li key={item.id}>
            {editing?.id === item.id ? (
              <form className="form" onSubmit={(event) => void save.submit(event)}>
                <ErrorSummary error={save.error} />
                <TextField
                  label="Nome"
                  maxLength={FIELD_LIMITS.shortName}
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {withDescription ? (
                  <TextArea
                    label="Descrição"
                    maxLength={1000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                ) : null}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
                    <Icon name="check-lg" /> Salvar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditing(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="row">
                <div style={{ flex: '1 1 14rem' }}>
                  <strong>{item.name}</strong>{' '}
                  {item.locked ? <span className="badge">sistema</span> : null}{' '}
                  {item.isActive ? null : <span className="badge">inativa</span>}
                  {item.detail ? <small className="muted"> · {item.detail}</small> : null}
                  {item.description ? (
                    <div className="muted line-clamp-2">{item.description}</div>
                  ) : null}
                </div>
                {rowExtra ? rowExtra(item) : null}
                {manage ? (
                  <div className="row" style={{ gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setNotice(null);
                        setForm({ name: item.name, description: item.description ?? '' });
                        setEditing(item);
                      }}
                    >
                      <Icon name="pencil" /> Editar
                    </button>
                    {item.locked ? null : (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void toggle(item)}
                        >
                          {item.isActive ? 'Inativar' : 'Reativar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDeleting(item)}
                        >
                          <Icon name="trash" /> Excluir
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir ${noun} ${deleting?.name ?? ''}`}
        description={
          deleteHint ??
          `Só é possível excluir ${noun} que não esteja em uso. Se estiver, inative para esconder sem perder o histórico.`
        }
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          await api(`${endpoint}/${deleting?.id ?? ''}`, { method: 'DELETE', body: { reason } });
          setNotice(`${capitalize(noun)} excluída.`);
          await onChanged();
        }}
      />
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
