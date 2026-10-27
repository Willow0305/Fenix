'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Icon } from '../../../components/icon';
import { PlanForm, type PlanPayload } from '../../../components/plan-form';
import { Alert, ConfirmDialog, PageHeader, Skeleton } from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import type { Plan, PlanImpact } from '../../../lib/finance-types';
import { formatMoney } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

/**
 * Planos de mensalidade (docs/29 COR-021): quanto se cobra, em que dia vence e quem paga.
 * Cada plano tem sua tela com os atletas; aqui ficam criação, edição e exclusão.
 */
export default function PlansPage() {
  const { can } = useAuth();
  const plans = useResource<Plan[]>('/fee-plans');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [toggling, setToggling] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const manage = can('fees.plans.manage');
  const target = toggling ?? deleting;
  const deactivating = toggling?.status === 'ACTIVE';
  // Impacto de inativar ou excluir (DT-066), carregado ao abrir o diálogo.
  const impact = useResource<PlanImpact>(
    target && (deleting || deactivating) ? `/fee-plans/${target.id}/impact` : null
  );
  const [effects, setEffects] = useState({ cancelFutureFees: true, endAthletePlans: true });

  async function save(payload: PlanPayload, id?: string) {
    await api(id ? `/fee-plans/${id}` : '/fee-plans', {
      method: id ? 'PATCH' : 'POST',
      body: {
        name: payload.name,
        amount: payload.amount,
        dueDay: payload.dueDay,
        ...(payload.description || id ? { description: payload.description } : {})
      }
    });
    setNotice(id ? 'Plano atualizado.' : 'Plano criado.');
    setCreating(false);
    setEditing(null);
    await plans.reload();
  }

  return (
    <>
      <PageHeader
        title="Planos de mensalidade"
        description="Quanto se cobra, em que dia vence e quais atletas pagam cada plano."
        actions={
          manage && !creating ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              <Icon name="plus-lg" /> Novo plano
            </button>
          ) : null
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {creating || editing ? (
        <section className="card stack" aria-labelledby="plano-form">
          <h2 id="plano-form">{editing ? `Editar: ${editing.name}` : 'Novo plano'}</h2>
          <PlanForm
            key={editing?.id ?? 'novo'}
            source={editing ?? undefined}
            submitLabel={editing ? 'Salvar alterações' : 'Criar plano'}
            onSubmit={(payload) => save(payload, editing?.id)}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </section>
      ) : null}

      {plans.error ? <Alert kind="error">{plans.error}</Alert> : null}
      {plans.loading && !plans.data ? <Skeleton lines={4} /> : null}
      {plans.data && plans.data.length > 0 ? (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col" className="num">
                  Valor
                </th>
                <th scope="col">Vencimento</th>
                <th scope="col" className="num">
                  Atletas
                </th>
                <th scope="col">Situação</th>
                {manage ? <th scope="col">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {plans.data.map((plan) => (
                <tr key={plan.id}>
                  <td data-label="Plano">
                    <Link href={`/admin/planos/${plan.id}`}>{plan.name}</Link>
                    {plan.description ? (
                      <div className="muted line-clamp-2" style={{ fontWeight: 400 }}>
                        {plan.description}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Valor" className="num">
                    {formatMoney(plan.amount.amount)}
                  </td>
                  <td data-label="Vencimento">Dia {plan.dueDay}</td>
                  <td data-label="Atletas" className="num">
                    <Link href={`/admin/planos/${plan.id}`}>{plan.activeAthletes}</Link>
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${plan.status === 'ACTIVE' ? 'badge-success' : ''}`}>
                      {plan.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  {manage ? (
                    <td data-label="Ações">
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <Link
                          href={`/admin/planos/${plan.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <Icon name="people" /> Atletas
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setCreating(false);
                            setEditing(plan);
                          }}
                        >
                          <Icon name="pencil" /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEffects({ cancelFutureFees: true, endAthletePlans: true });
                            setToggling(plan);
                          }}
                        >
                          {plan.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDeleting(plan)}
                        >
                          <Icon name="trash" /> Excluir
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : plans.data ? (
        <p className="card empty">Nenhum plano cadastrado. Crie o primeiro em “Novo plano”.</p>
      ) : null}

      <ConfirmDialog
        open={toggling !== null}
        title={
          deactivating ? `Inativar ${toggling?.name ?? ''}` : `Reativar ${toggling?.name ?? ''}`
        }
        description={
          deactivating
            ? 'O plano deixa de gerar cobranças e não pode ser atribuído. Escolha o que fazer com o que já existe; meses passados e cobranças com pagamento nunca mudam.'
            : 'O plano volta a gerar cobranças para os atletas vinculados.'
        }
        confirmLabel={deactivating ? 'Inativar' : 'Reativar'}
        requireReason={deactivating && (effects.cancelFutureFees || effects.endAthletePlans)}
        onClose={() => setToggling(null)}
        onConfirm={async (reason) => {
          if (!toggling) {
            return;
          }

          await api(`/fee-plans/${toggling.id}`, {
            method: 'PATCH',
            body: deactivating
              ? { status: 'INACTIVE', ...effects, ...(reason ? { reason } : {}) }
              : { status: 'ACTIVE' }
          });
          setNotice(deactivating ? 'Plano inativado.' : 'Plano reativado.');
          await plans.reload();
        }}
      >
        {deactivating && impact.data ? (
          <fieldset className="form-section">
            <legend>O que já existe</legend>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={impact.data.cancellableFees === 0}
                checked={effects.cancelFutureFees}
                onChange={(e) => setEffects({ ...effects, cancelFutureFees: e.target.checked })}
              />
              <span>
                Cancelar {impact.data.cancellableFees} mensalidade(s) deste mês em diante sem
                pagamento
              </span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={impact.data.activeAthletes === 0}
                checked={effects.endAthletePlans}
                onChange={(e) => setEffects({ ...effects, endAthletePlans: e.target.checked })}
              />
              <span>
                Encerrar hoje o plano de {impact.data.activeAthletes} atleta(s), para receberem
                outro
              </span>
            </label>
            {impact.data.keptOpenFees > 0 ? (
              <small className="muted">
                {impact.data.keptOpenFees} mensalidade(s) de meses passados ou com pagamento
                continuam em aberto (dívida real).
              </small>
            ) : null}
          </fieldset>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir ${deleting?.name ?? ''}`}
        description={
          impact.data
            ? `O plano some das listas e para de cobrar: ${impact.data.cancellableFees} mensalidade(s) deste mês em diante sem pagamento serão canceladas e ${impact.data.activeAthletes} atleta(s) saem do plano hoje. ${impact.data.keptOpenFees} cobrança(s) de meses passados ou com pagamento continuam em aberto.`
            : 'O plano some das listas e para de cobrar.'
        }
        confirmLabel="Excluir"
        danger
        requireReason
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          await api(`/fee-plans/${deleting?.id ?? ''}`, { method: 'DELETE', body: { reason } });
          setNotice('Plano excluído.');
          await plans.reload();
        }}
      />
    </>
  );
}
