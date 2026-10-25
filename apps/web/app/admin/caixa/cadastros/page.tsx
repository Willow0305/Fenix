'use client';

import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  PageHeader,
  SelectField,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  type Account,
  ACCOUNT_TYPE,
  type AccountType,
  type CostCenter,
  type FinanceCategory,
  type PaymentMethod
} from '../../../../lib/finance-types';
import { todayCivil } from '../../../../lib/format';
import { normalizeAmount, useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';
import { CategoryManager } from '../../../../components/category-manager';

const NATURE: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  TRANSFER: 'Transferência'
};

export default function FinanceSetupPage() {
  const { can } = useAuth();
  const manage = can('finance.setup');
  const accounts = useResource<Account[]>('/finance/accounts');
  const categories = useResource<FinanceCategory[]>('/finance/categories');
  const centers = useResource<CostCenter[]>('/finance/cost-centers');
  const methods = useResource<PaymentMethod[]>('/finance/payment-methods');
  const openingKey = useIdempotencyKey();
  const [account, setAccount] = useState({
    name: '',
    type: 'BANK' as AccountType,
    institutionName: ''
  });
  const [category, setCategory] = useState({ name: '', nature: 'EXPENSE' });
  const [center, setCenter] = useState('');
  const [opening, setOpening] = useState<Account | null>(null);
  const [openingForm, setOpeningForm] = useState({ amount: '', occurredOn: todayCivil() });
  const [notice, setNotice] = useState<string | null>(null);

  const createAccount = useSubmit(async () => {
    await api('/finance/accounts', {
      method: 'POST',
      body: {
        name: account.name,
        type: account.type,
        ...(account.institutionName ? { institutionName: account.institutionName } : {})
      }
    });
    setAccount({ name: '', type: 'BANK', institutionName: '' });
    await accounts.reload();
  });
  const createCategory = useSubmit(async () => {
    await api('/finance/categories', { method: 'POST', body: category });
    setCategory({ name: '', nature: 'EXPENSE' });
    await categories.reload();
  });
  const createCenter = useSubmit(async () => {
    await api('/finance/cost-centers', { method: 'POST', body: { name: center } });
    setCenter('');
    await centers.reload();
  });

  return (
    <>
      <PageHeader
        title="Contas e categorias"
        description="Plano de contas provisório; categorias do sistema não podem ser inativadas."
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <section className="card stack" aria-labelledby="contas">
        <h2 id="contas">Contas financeiras</h2>
        <ul>
          {(accounts.data ?? []).map((a) => (
            <li key={a.id} className="row">
              <strong>{a.name}</strong>
              <span className="muted">{ACCOUNT_TYPE[a.type]}</span>
              {a.isActive ? null : <span className="badge">Inativa</span>}
              {manage ? (
                <>
                  <button type="button" className="btn btn-link" onClick={() => setOpening(a)}>
                    Saldo inicial
                  </button>
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() =>
                      void api(`/finance/accounts/${a.id}`, {
                        method: 'PATCH',
                        body: { isActive: !a.isActive }
                      }).then(accounts.reload)
                    }
                  >
                    {a.isActive ? 'Inativar' : 'Reativar'}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {manage ? (
          <form className="row" onSubmit={(event) => void createAccount.submit(event)}>
            <TextField
              label="Nova conta"
              maxLength={120}
              required
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
            />
            <SelectField
              label="Tipo"
              value={account.type}
              onChange={(e) => setAccount({ ...account, type: e.target.value as AccountType })}
              options={Object.entries(ACCOUNT_TYPE).map(([value, label]) => ({ value, label }))}
            />
            <TextField
              label="Banco (opcional)"
              maxLength={160}
              value={account.institutionName}
              onChange={(e) => setAccount({ ...account, institutionName: e.target.value })}
            />
            <button type="submit" className="btn btn-secondary">
              Adicionar
            </button>
            <ErrorSummary error={createAccount.error} />
          </form>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="categorias">
        <h2 id="categorias">Categorias</h2>
        <CategoryManager
          items={(categories.data ?? []).map((c) => ({
            ...c,
            detail: NATURE[c.nature],
            locked: c.isSystem
          }))}
          endpoint="/finance/categories"
          manage={manage}
          withDescription={false}
          onChanged={categories.reload}
        />
        {manage ? (
          <form className="row" onSubmit={(event) => void createCategory.submit(event)}>
            <TextField
              label="Nova categoria"
              maxLength={120}
              required
              value={category.name}
              onChange={(e) => setCategory({ ...category, name: e.target.value })}
            />
            <SelectField
              label="Natureza"
              value={category.nature}
              onChange={(e) => setCategory({ ...category, nature: e.target.value })}
              options={[
                { value: 'EXPENSE', label: 'Despesa' },
                { value: 'INCOME', label: 'Receita' }
              ]}
            />
            <button type="submit" className="btn btn-secondary">
              Adicionar
            </button>
            <ErrorSummary error={createCategory.error} />
          </form>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="centros">
        <h2 id="centros">Centros de custo</h2>
        <CategoryManager
          items={centers.data ?? []}
          endpoint="/finance/cost-centers"
          manage={manage}
          withDescription={false}
          noun="centro de custo"
          emptyText="Nenhum centro de custo (opcional)."
          onChanged={centers.reload}
        />
        {manage ? (
          <form className="row" onSubmit={(event) => void createCenter.submit(event)}>
            <TextField
              label="Novo centro de custo"
              maxLength={120}
              required
              value={center}
              onChange={(e) => setCenter(e.target.value)}
              hint="Ex.: Time feminino, Campeonato estadual"
            />
            <button type="submit" className="btn btn-secondary">
              Adicionar
            </button>
          </form>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="formas">
        <h2 id="formas">Formas de pagamento</h2>
        <ul>
          {(methods.data ?? []).map((m) => (
            <li key={m.id} className="row">
              {m.name} {m.isActive ? null : <span className="badge">inativa</span>}
              {manage ? (
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() =>
                    void api(`/finance/payment-methods/${m.id}/active`, {
                      method: 'PUT',
                      body: { isActive: !m.isActive }
                    }).then(methods.reload)
                  }
                >
                  {m.isActive ? 'Inativar' : 'Reativar'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={opening !== null}
        title={`Saldo inicial — ${opening?.name ?? ''}`}
        description="Registra uma única vez o saldo de abertura da conta, com a origem (extrato, contagem)."
        confirmLabel="Registrar saldo inicial"
        requireReason
        onClose={() => setOpening(null)}
        onConfirm={async (reason) => {
          await api(`/finance/accounts/${opening?.id ?? ''}/opening-balance`, {
            method: 'POST',
            headers: openingKey.headers(),
            body: {
              amount: normalizeAmount(openingForm.amount),
              occurredOn: openingForm.occurredOn,
              notes: reason
            }
          });
          openingKey.rotate();
          setNotice('Saldo inicial registrado.');
        }}
      >
        <TextField
          label="Valor (R$)"
          maxLength={16}
          inputMode="decimal"
          value={openingForm.amount}
          onChange={(e) => setOpeningForm({ ...openingForm, amount: e.target.value })}
        />
        <TextField
          label="Data"
          type="date"
          value={openingForm.occurredOn}
          onChange={(e) => setOpeningForm({ ...openingForm, occurredOn: e.target.value })}
        />
      </ConfirmDialog>
    </>
  );
}
