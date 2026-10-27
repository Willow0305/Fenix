'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AffiliationNav } from '../../../../../components/affiliation-nav';
import { Icon } from '../../../../../components/icon';
import { ProductImagesManager } from '../../../../../components/product-images-manager';
import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../../../components/ui';
import { api } from '../../../../../lib/api-client';
import type { Page } from '../../../../../lib/api-types';
import { useAuth } from '../../../../../lib/auth-context';
import type { CardAdminRow } from '../../../../../lib/card-types';
import { formatDate, formatDateTime } from '../../../../../lib/format';
import { normalizeAmount } from '../../../../../lib/idempotency';
import {
  PRODUCT_STATUS,
  type ProductDetail,
  type ProductStatus
} from '../../../../../lib/store-types';
import { useResource } from '../../../../../lib/use-resource';

/** ISO (UTC) para o valor de um campo `datetime-local` no fuso do navegador. */
function toLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface PlanForm {
  name: string;
  basePrice: string;
  promotionalPrice: string;
  membershipMonths: string;
  availableFrom: string;
  availableUntil: string;
  buyerLimit: string;
  isFeatured: string;
  description: string;
}

function formOf(p: ProductDetail): PlanForm {
  return {
    name: p.name,
    basePrice: p.basePrice?.amount ?? p.listPriceFrom.amount,
    promotionalPrice: p.promotionalPrice?.amount ?? '',
    membershipMonths: p.membershipMonths ? String(p.membershipMonths) : '',
    availableFrom: toLocalInput(p.availableFrom),
    availableUntil: toLocalInput(p.availableUntil),
    buyerLimit: p.buyerLimit ? String(p.buyerLimit) : '',
    isFeatured: p.isFeatured ? 'true' : 'false',
    description: p.description ?? ''
  };
}

/** Plano de afiliação (DT-072): dados de venda, imagem, situação, aviso e carteirinhas. */
export default function MembershipPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const product = useResource<ProductDetail>(`/store/products/${id}`);
  const cards = useResource<Page<CardAdminRow>>(can('cards.read') ? '/cards' : null, {
    planId: id,
    pageSize: 10
  });
  const [form, setForm] = useState<PlanForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (product.data) {
      if (product.data.fulfillmentType !== 'MEMBERSHIP') {
        router.replace(`/admin/produtos/${id}`);
      } else {
        setForm(formOf(product.data));
      }
    }
  }, [product.data, router, id]);

  const save = useSubmit(async () => {
    if (!form) {
      return;
    }

    product.setData(
      await api<ProductDetail>(`/store/products/${id}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          basePrice: normalizeAmount(form.basePrice),
          promotionalPrice: form.promotionalPrice ? normalizeAmount(form.promotionalPrice) : '',
          membershipMonths: Number(form.membershipMonths),
          availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : '',
          availableUntil: form.availableUntil ? new Date(form.availableUntil).toISOString() : '',
          buyerLimit: form.buyerLimit ? Number(form.buyerLimit) : 0,
          isFeatured: form.isFeatured === 'true',
          description: form.description
        }
      })
    );
    setNotice('Plano salvo.');
  });

  async function setStatus(status: ProductStatus, reason?: string) {
    product.setData(
      await api<ProductDetail>(`/store/products/${id}/status`, {
        method: 'PUT',
        body: { status, ...(reason ? { reason } : {}) }
      })
    );
    setNotice(
      status === 'ACTIVE'
        ? 'Plano à venda na loja.'
        : status === 'INACTIVE'
          ? 'Venda pausada: o plano saiu da loja.'
          : 'Plano excluído.'
    );
  }

  if (!product.data || !form) {
    return product.error ? <Alert kind="error">{product.error}</Alert> : <Loading />;
  }

  const p = product.data;
  const set = (key: keyof PlanForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <>
      <PageHeader
        title={p.name}
        description={`Plano de afiliação · carteirinha válida por ${p.membershipMonths ?? '—'} meses`}
        actions={
          <>
            {p.status === 'ACTIVE' ? (
              <Link href={`/loja/${p.slug}`} target="_blank">
                Ver na loja
              </Link>
            ) : null}
            <Link href="/admin/afiliacao/planos">
              <Icon name="arrow-left" /> Planos
            </Link>
          </>
        }
      />
      <AffiliationNav />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <section className="card row">
        <span className={`badge ${PRODUCT_STATUS[p.status].badge}`}>
          {p.status === 'ACTIVE'
            ? 'À venda'
            : p.status === 'INACTIVE'
              ? 'Venda pausada'
              : PRODUCT_STATUS[p.status].label}
        </span>
        <span className="muted">
          {p.status === 'DRAFT'
            ? 'Rascunho: ainda não aparece na loja.'
            : p.status === 'ARCHIVED'
              ? 'Excluído: não volta para a loja.'
              : 'Carteirinhas já vendidas continuam valendo em qualquer situação do plano.'}
        </span>
        <span className="spacer" />
        {p.status !== 'ACTIVE' && p.status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void setStatus('ACTIVE').catch((e: Error) => setNotice(e.message))}
          >
            {p.status === 'DRAFT' ? 'Publicar na loja' : 'Retomar venda'}
          </button>
        ) : null}
        {p.status === 'ACTIVE' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void setStatus('INACTIVE')}
          >
            Pausar venda
          </button>
        ) : null}
        {p.status !== 'ARCHIVED' ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setArchiving(true)}
          >
            Excluir
          </button>
        ) : null}
      </section>

      {p.status === 'ACTIVE' && can('notifications.send') ? (
        <section className="card row">
          <Icon name="megaphone" />
          {p.membershipAnnouncedAt ? (
            <span className="muted">
              Aviso &quot;afiliações abertas&quot; enviado a todas as contas em{' '}
              {formatDateTime(p.membershipAnnouncedAt)}.
            </span>
          ) : (
            <>
              <span>Avise todas as contas que as afiliações estão abertas (uma vez só).</span>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  void api<{ notified: number }>(`/store/products/${id}/announce-membership`, {
                    method: 'POST',
                    body: {}
                  }).then(async (res) => {
                    setNotice(`Aviso enviado para ${res.notified} conta(s).`);
                    await product.reload();
                  })
                }
              >
                Avisar todos
              </button>
            </>
          )}
        </section>
      ) : null}

      <form className="form card" onSubmit={(event) => void save.submit(event)}>
        <h2 className="m-0">Dados do plano</h2>
        <ErrorSummary error={save.error} />
        <div className="form-grid">
          <TextField
            label="Nome"
            maxLength={160}
            required
            value={form.name}
            onChange={set('name')}
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
            label="Preço promocional"
            numeric="decimal"
            maxLength={16}
            value={form.promotionalPrice}
            onChange={set('promotionalPrice')}
            hint="Vazio remove a promoção."
          />
          <TextField
            label="Validade (meses)"
            numeric="integer"
            maxLength={2}
            required
            value={form.membershipMonths}
            onChange={set('membershipMonths')}
            hint="Vale para as próximas vendas. Carteirinhas já emitidas mantêm a data (use Estender validade nelas)."
          />
          <TextField
            label="Venda a partir de (opcional)"
            type="datetime-local"
            value={form.availableFrom}
            onChange={set('availableFrom')}
          />
          <TextField
            label="Venda até (opcional)"
            type="datetime-local"
            value={form.availableUntil}
            onChange={set('availableUntil')}
            hint="Vazio: vende enquanto estiver publicado."
          />
          <TextField
            label="Limite por comprador"
            numeric="integer"
            maxLength={4}
            value={form.buyerLimit}
            onChange={set('buyerLimit')}
            hint="Vazio ou 0 = sem limite."
          />
          <SelectField
            label="Destaque na loja"
            value={form.isFeatured}
            onChange={set('isFeatured')}
            options={[
              { value: 'false', label: 'Não' },
              { value: 'true', label: 'Sim' }
            ]}
          />
        </div>
        <TextArea
          label="Descrição"
          maxLength={8000}
          value={form.description}
          onChange={set('description')}
          hint="Aparece na loja. Os benefícios dos parceiros são mostrados automaticamente."
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={save.pending}>
            Salvar plano
          </button>
        </div>
      </form>

      <ProductImagesManager
        productId={id}
        images={p.images}
        onChange={(detail) => product.setData(detail)}
      />

      {cards.data ? (
        <section className="card stack" aria-labelledby="carteirinhas-plano">
          <div className="row">
            <h2 id="carteirinhas-plano" className="m-0">
              Carteirinhas deste plano ({cards.data.meta.total})
            </h2>
            <span className="spacer" />
            {cards.data.meta.total > 0 ? (
              <Link href={`/admin/afiliacao/carteirinhas?plano=${id}`}>Ver todas</Link>
            ) : null}
          </div>
          {cards.data.data.length === 0 ? (
            <p className="muted m-0">Nenhuma carteirinha vendida por este plano ainda.</p>
          ) : (
            <ul className="stack list-plain">
              {cards.data.data.map((c) => (
                <li key={c.id} className="row">
                  <strong>{c.holderName}</strong>
                  <span className="muted">{c.code}</span>
                  {c.endsOn ? <span className="muted">até {formatDate(c.endsOn)}</span> : null}
                  <span className="spacer" />
                  <span className={`badge ${c.state === 'VALID' ? 'badge-success' : ''}`}>
                    {c.stateLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={archiving}
        title="Excluir plano"
        description="O plano sai da loja. Carteirinhas já vendidas continuam valendo até o fim da validade."
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setArchiving(false)}
        onConfirm={async (reason) => setStatus('ARCHIVED', reason)}
      />
    </>
  );
}
