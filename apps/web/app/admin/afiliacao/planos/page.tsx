'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { AffiliationNav } from '../../../../components/affiliation-nav';
import { Icon } from '../../../../components/icon';
import {
  Alert,
  Empty,
  ErrorSummary,
  PageHeader,
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import type { CardsOverview } from '../../../../lib/card-types';
import { formatMoney } from '../../../../lib/format';
import { normalizeAmount } from '../../../../lib/idempotency';
import { PRODUCT_STATUS, type ProductDetail } from '../../../../lib/store-types';
import { useResource } from '../../../../lib/use-resource';
import { salesWindow } from '../plan-format';

const EMPTY = { name: '', basePrice: '', membershipMonths: '12', description: '' };

/** Planos de afiliação (DT-072): cada plano é vendido na loja e gera carteirinhas. */
function PlansPage() {
  const router = useRouter();
  const params = useSearchParams();
  const overview = useResource<CardsOverview>('/cards/overview');
  const [creating, setCreating] = useState(params.get('novo') === '1');
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const create = useSubmit(async () => {
    const created = await api<ProductDetail>('/store/memberships', {
      method: 'POST',
      body: {
        name: form.name,
        basePrice: normalizeAmount(form.basePrice),
        membershipMonths: Number(form.membershipMonths),
        ...(form.description ? { description: form.description } : {})
      }
    });

    router.push(`/admin/afiliacao/planos/${created.id}`);
  });
  const plans = overview.data?.plans;

  return (
    <>
      <PageHeader
        title="Planos de afiliação"
        description="O que é vendido na loja: preço, validade da carteirinha e período de venda."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            {creating ? (
              'Fechar'
            ) : (
              <>
                <Icon name="plus-lg" /> Novo plano
              </>
            )}
          </button>
        }
      />
      <AffiliationNav />
      {creating ? (
        <form className="form card" onSubmit={(event) => void create.submit(event)}>
          <h2 className="m-0">Novo plano</h2>
          <p className="muted m-0">
            O plano nasce como rascunho. Depois de criado, ajuste imagem e período de venda e
            publique.
          </p>
          <ErrorSummary error={create.error} />
          <div className="form-grid">
            <TextField
              label="Nome"
              maxLength={160}
              required
              value={form.name}
              onChange={set('name')}
              placeholder="Afiliação Fênix 2027"
            />
            <TextField
              label="Preço (R$)"
              numeric="decimal"
              maxLength={16}
              required
              value={form.basePrice}
              onChange={set('basePrice')}
              hint="Por carteirinha (cada beneficiário)."
            />
            <TextField
              label="Validade (meses)"
              numeric="integer"
              maxLength={2}
              required
              value={form.membershipMonths}
              onChange={set('membershipMonths')}
              hint="Contada a partir da confirmação do pagamento. De 1 a 60."
            />
          </div>
          <TextArea
            label="Descrição (opcional)"
            maxLength={8000}
            value={form.description}
            onChange={set('description')}
            hint="Aparece na loja. Os benefícios dos parceiros são mostrados automaticamente."
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={create.pending}>
              Criar plano
            </button>
          </div>
        </form>
      ) : null}
      {overview.error ? <Alert kind="error">{overview.error}</Alert> : null}
      {!plans && !overview.error ? <Skeleton lines={4} /> : null}
      {plans?.length === 0 ? <Empty>Nenhum plano de afiliação cadastrado.</Empty> : null}
      {plans && plans.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col" className="num">
                  Preço
                </th>
                <th scope="col">Validade</th>
                <th scope="col">Venda</th>
                <th scope="col" className="num">
                  Carteirinhas
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td data-label="Plano">
                    <Link href={`/admin/afiliacao/planos/${plan.id}`}>
                      <strong>{plan.name}</strong>
                    </Link>
                  </td>
                  <td data-label="Preço" className="num">
                    {plan.promotionalPrice ? (
                      <>
                        <s className="muted">{formatMoney(plan.price.amount)}</s>{' '}
                        {formatMoney(plan.promotionalPrice.amount)}
                      </>
                    ) : (
                      formatMoney(plan.price.amount)
                    )}
                  </td>
                  <td data-label="Validade">{plan.membershipMonths ?? '—'} meses</td>
                  <td data-label="Venda">{salesWindow(plan)}</td>
                  <td data-label="Carteirinhas" className="num">
                    {plan.activeCards} ativa(s) de {plan.issuedCards}
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${PRODUCT_STATUS[plan.status].badge}`}>
                      {plan.status === 'ACTIVE'
                        ? 'À venda'
                        : plan.status === 'INACTIVE'
                          ? 'Venda pausada'
                          : PRODUCT_STATUS[plan.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

export default function MembershipPlansPage() {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <PlansPage />
    </Suspense>
  );
}
