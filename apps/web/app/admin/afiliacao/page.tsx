'use client';

import Link from 'next/link';

import { AffiliationNav } from '../../../components/affiliation-nav';
import { Icon } from '../../../components/icon';
import { Alert, Empty, PageHeader, Skeleton } from '../../../components/ui';
import { useAuth } from '../../../lib/auth-context';
import type { BenefitAdmin, CardsOverview } from '../../../lib/card-types';
import { formatMoney } from '../../../lib/format';
import { PRODUCT_STATUS } from '../../../lib/store-types';
import { useResource } from '../../../lib/use-resource';
import { salesWindow } from './plan-format';

/** Visão geral da Afiliação (DT-072): números, planos à venda e benefícios valendo. */
export default function AffiliationOverviewPage() {
  const { can } = useAuth();
  const overview = useResource<CardsOverview>('/cards/overview');
  const benefits = useResource<BenefitAdmin[]>(can('benefits.manage') ? '/partner-benefits' : null);
  const o = overview.data;
  const inEffect = (benefits.data ?? []).filter((b) => b.inEffect);

  return (
    <>
      <PageHeader
        title="Afiliação"
        description="Planos de afiliação, benefícios dos parceiros e carteirinhas digitais num lugar só."
        actions={
          can('products.manage') ? (
            <Link href="/admin/afiliacao/planos?novo=1" className="btn btn-primary">
              <Icon name="plus-lg" /> Novo plano
            </Link>
          ) : null
        }
      />
      <AffiliationNav />
      {overview.error ? <Alert kind="error">{overview.error}</Alert> : null}
      {!o ? <Skeleton lines={4} /> : null}
      {o ? (
        <>
          <dl className="stat-grid">
            <div className="stat">
              <dt className="stat-label">Afiliados com carteirinha válida</dt>
              <dd className="stat-value">{o.affiliates.valid}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Vencem nos próximos 15 dias</dt>
              <dd className="stat-value">{o.affiliates.expiringSoon}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Suspensas · vencidas</dt>
              <dd className="stat-value">
                {o.affiliates.suspended} · {o.affiliates.expired}
              </dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Atletas com carteirinha válida</dt>
              <dd className="stat-value">{o.athletes.valid}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Benefícios valendo</dt>
              <dd className="stat-value">
                {o.benefits.inEffect}
                <span className="muted"> de {o.benefits.total}</span>
              </dd>
            </div>
          </dl>

          <section className="card stack" aria-labelledby="planos">
            <div className="row">
              <h2 id="planos" className="m-0">
                Planos de afiliação
              </h2>
              <span className="spacer" />
              {can('products.manage') ? (
                <Link href="/admin/afiliacao/planos">Gerenciar planos</Link>
              ) : null}
            </div>
            {o.plans.length === 0 ? (
              <Empty>
                Nenhum plano ainda. Crie um plano com preço e validade para vender a afiliação na
                loja.
              </Empty>
            ) : (
              <ul className="stack list-plain">
                {o.plans.map((plan) => (
                  <li key={plan.id} className="row">
                    <span className={`badge ${PRODUCT_STATUS[plan.status].badge}`}>
                      {PRODUCT_STATUS[plan.status].label}
                    </span>
                    {can('products.manage') ? (
                      <Link href={`/admin/afiliacao/planos/${plan.id}`}>
                        <strong>{plan.name}</strong>
                      </Link>
                    ) : (
                      <strong>{plan.name}</strong>
                    )}
                    <span className="muted">
                      {formatMoney(plan.promotionalPrice?.amount ?? plan.price.amount)} ·{' '}
                      {plan.membershipMonths ?? '—'} meses · {salesWindow(plan)}
                    </span>
                    <span className="spacer" />
                    <span>{plan.activeCards} ativa(s)</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {benefits.data ? (
            <section className="card stack" aria-labelledby="beneficios">
              <div className="row">
                <h2 id="beneficios" className="m-0">
                  Benefícios valendo hoje
                </h2>
                <span className="spacer" />
                <Link href="/admin/afiliacao/beneficios">Gerenciar benefícios</Link>
              </div>
              {inEffect.length === 0 ? (
                <Empty>Nenhum benefício valendo. Cadastre descontos com os parceiros.</Empty>
              ) : (
                <ul className="stack list-plain">
                  {inEffect.map((b) => (
                    <li key={b.id} className="row">
                      <strong>{b.discountPercent}%</strong>
                      <span>{b.title}</span>
                      <span className="muted">· {b.partner.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="card stack" aria-labelledby="como-funciona">
            <h2 id="como-funciona" className="m-0">
              Como funciona
            </h2>
            <ol className="stack">
              <li>
                <strong>Plano:</strong> defina nome, preço e validade em meses. Publicado, ele
                aparece na loja; o período de venda é opcional.
              </li>
              <li>
                <strong>Benefícios:</strong> cadastre os descontos de cada parceiro. Eles valem para
                todas as carteirinhas do público escolhido (atletas, afiliados ou ambos).
              </li>
              <li>
                <strong>Venda:</strong> quem compra informa o nome de cada beneficiário. Com o
                pagamento confirmado, cada um recebe a carteirinha digital.
              </li>
              <li>
                <strong>Acompanhamento:</strong> em Carteirinhas, a diretoria suspende, reativa,
                estende a validade, reemite ou cancela, sempre com motivo.
              </li>
            </ol>
          </section>
        </>
      ) : null}
    </>
  );
}
