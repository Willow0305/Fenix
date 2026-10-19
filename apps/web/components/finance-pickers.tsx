'use client';

import type { Account, FinanceCategory, PaymentMethod } from '../lib/finance-types';
import { useResource } from '../lib/use-resource';
import { SelectField } from './ui';

/** Seletores reutilizáveis do Caixa (somente itens ativos). */
export function AccountSelect({
  value,
  onChange,
  label = 'Conta que recebeu',
  required = true,
  allowEmpty = false
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label?: string;
  readonly required?: boolean;
  readonly allowEmpty?: boolean;
}) {
  const accounts = useResource<Account[]>('/finance/accounts');

  return (
    <SelectField
      label={label}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: allowEmpty ? 'Todas' : 'Selecione' },
        ...(accounts.data ?? [])
          .filter((a) => a.isActive)
          .map((a) => ({ value: a.id, label: a.name }))
      ]}
    />
  );
}

export function MethodSelect({
  value,
  onChange,
  required = true
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
}) {
  const methods = useResource<PaymentMethod[]>('/finance/payment-methods');

  return (
    <SelectField
      label="Forma de pagamento"
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: required ? 'Selecione' : 'Não informada' },
        ...(methods.data ?? [])
          .filter((m) => m.isActive)
          .map((m) => ({ value: m.id, label: m.name }))
      ]}
    />
  );
}

export function CategorySelect({
  value,
  onChange,
  nature,
  allowEmpty = false,
  required = true
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly nature?: 'INCOME' | 'EXPENSE';
  readonly allowEmpty?: boolean;
  readonly required?: boolean;
}) {
  const categories = useResource<FinanceCategory[]>('/finance/categories');
  const list = (categories.data ?? []).filter(
    (c) => c.isActive && c.nature !== 'TRANSFER' && (nature === undefined || c.nature === nature)
  );

  return (
    <SelectField
      label="Categoria"
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: allowEmpty ? 'Todas' : 'Selecione' },
        ...list.map((c) => ({ value: c.id, label: c.name }))
      ]}
    />
  );
}
