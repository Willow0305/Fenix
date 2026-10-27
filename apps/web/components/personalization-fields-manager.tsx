'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { formatMoney } from '../lib/format';
import { normalizeAmount } from '../lib/idempotency';
import type { PersonalizationField, ProductDetail } from '../lib/store-types';
import { Icon } from './icon';
import { ConfirmDialog, ErrorSummary, SelectField, TextField, useSubmit } from './ui';

interface FieldForm {
  label: string;
  kind: 'TEXT' | 'NUMBER';
  required: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  extraPrice: string;
}

const EMPTY: FieldForm = {
  label: '',
  kind: 'TEXT',
  required: 'true',
  maxLength: '12',
  minValue: '0',
  maxValue: '99',
  extraPrice: ''
};

/**
 * Campos de personalização do produto (DT-069): ex.: "Nome na camisa" (texto até 12
 * letras, maiúsculas, +R$ 15) e "Número" (0 a 99). Pedidos feitos guardam a própria cópia.
 */
export function PersonalizationFieldsManager({
  product,
  onChange
}: {
  readonly product: ProductDetail;
  readonly onChange: (detail: ProductDetail) => void;
}) {
  const [form, setForm] = useState<FieldForm>(EMPTY);
  const [deleting, setDeleting] = useState<PersonalizationField | null>(null);
  const set = (key: keyof FieldForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const add = useSubmit(async () => {
    onChange(
      await api<ProductDetail>(`/store/products/${product.id}/personalization-fields`, {
        method: 'POST',
        body: {
          label: form.label,
          kind: form.kind,
          required: form.required === 'true',
          sortOrder: product.personalizationFields.length,
          ...(form.kind === 'TEXT'
            ? { maxLength: Number(form.maxLength || 12) }
            : { minValue: Number(form.minValue || 0), maxValue: Number(form.maxValue || 99) }),
          ...(form.extraPrice ? { extraPrice: normalizeAmount(form.extraPrice) } : {})
        }
      })
    );
    setForm(EMPTY);
  });

  async function toggle(field: PersonalizationField) {
    onChange(
      await api<ProductDetail>(`/store/personalization-fields/${field.id}`, {
        method: 'PATCH',
        body: { isActive: !field.isActive }
      })
    );
  }

  return (
    <section className="card stack" aria-labelledby="personalizacao">
      <h2 id="personalizacao" style={{ margin: 0 }}>
        Personalização
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        Com algum campo ativo, o produto vira personalizado: o cliente preenche na compra, cada
        personalização é uma linha do carrinho e o item não tem troca por arrependimento.
      </p>
      {product.personalizationFields.length > 0 ? (
        <ul className="stack" style={{ gap: '0.4rem', paddingLeft: 0, listStyle: 'none' }}>
          {product.personalizationFields.map((field) => (
            <li key={field.id} className="row">
              <strong>{field.label}</strong>
              <span className="muted">
                {field.kind === 'TEXT'
                  ? `texto até ${field.maxLength ?? 30}${field.uppercase ? ', maiúsculas' : ''}`
                  : `número de ${field.minValue ?? 0} a ${field.maxValue ?? 99}`}
                {field.required ? ' · obrigatório' : ' · opcional'}
                {Number(field.extraPrice.amount) > 0
                  ? ` · +${formatMoney(field.extraPrice.amount)}`
                  : ''}
              </span>
              {field.isActive ? null : <span className="badge">inativo</span>}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void toggle(field)}
              >
                {field.isActive ? 'Desativar' : 'Reativar'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleting(field)}
              >
                <Icon name="trash" /> Excluir
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="row" onSubmit={(event) => void add.submit(event)}>
        <TextField
          label="Novo campo"
          maxLength={60}
          required
          placeholder="Nome na camisa"
          value={form.label}
          onChange={set('label')}
        />
        <SelectField
          label="Tipo"
          value={form.kind}
          onChange={set('kind')}
          options={[
            { value: 'TEXT', label: 'Texto' },
            { value: 'NUMBER', label: 'Número' }
          ]}
        />
        {form.kind === 'TEXT' ? (
          <TextField
            label="Máx. de letras"
            numeric="integer"
            maxLength={2}
            value={form.maxLength}
            onChange={set('maxLength')}
          />
        ) : (
          <>
            <TextField
              label="De"
              numeric="integer"
              maxLength={6}
              value={form.minValue}
              onChange={set('minValue')}
            />
            <TextField
              label="Até"
              numeric="integer"
              maxLength={6}
              value={form.maxValue}
              onChange={set('maxValue')}
            />
          </>
        )}
        <SelectField
          label="Preenchimento"
          value={form.required}
          onChange={set('required')}
          options={[
            { value: 'true', label: 'Obrigatório' },
            { value: 'false', label: 'Opcional' }
          ]}
        />
        <TextField
          label="Acréscimo (R$)"
          numeric="decimal"
          maxLength={10}
          value={form.extraPrice}
          onChange={set('extraPrice')}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={add.pending}>
          Adicionar campo
        </button>
        <ErrorSummary error={add.error} />
      </form>
      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir o campo ${deleting?.label ?? ''}`}
        description="O campo sai da loja. Pedidos já feitos guardam o que foi escolhido."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          onChange(
            await api<ProductDetail>(`/store/personalization-fields/${deleting?.id ?? ''}`, {
              method: 'DELETE',
              body: { reason }
            })
          );
        }}
      />
    </section>
  );
}
