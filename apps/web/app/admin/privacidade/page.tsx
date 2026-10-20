'use client';

import { useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  Loading,
  PageHeader,
  Pagination
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDateTime } from '../../../lib/format';
import {
  PRIVACY_STATUS,
  PRIVACY_TYPE,
  type PrivacyRequest,
  type PrivacyStatus
} from '../../../lib/privacy-types';
import { useResource } from '../../../lib/use-resource';

type Action =
  | { request: PrivacyRequest; kind: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' }
  | { request: PrivacyRequest; kind: 'ANONYMIZE' };

export default function PrivacyAdminPage() {
  const [status, setStatus] = useState<PrivacyStatus | ''>('OPEN');
  const [page, setPage] = useState(1);
  const list = useResource<Page<PrivacyRequest>>('/privacy-requests', {
    status,
    page,
    pageSize: 25
  });
  const [action, setAction] = useState<Action | null>(null);

  return (
    <>
      <PageHeader
        title="Solicitações de titulares (LGPD)"
        description="Exportação é feita pelo próprio titular em Minha conta. Eliminação é atendida aqui por anonimização; pedidos, pagamentos e auditoria são mantidos por obrigação legal."
      />
      <div className="row">
        <label className="field">
          <span className="label">Situação</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as PrivacyStatus | '');
            }}
          >
            <option value="">Todas</option>
            {Object.entries(PRIVACY_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.error ? <Alert kind="error">{list.error}</Alert> : null}
      {list.loading && !list.data ? <Loading /> : null}
      {list.data?.data.length === 0 ? <Empty>Nenhuma solicitação.</Empty> : null}
      {list.data?.data.map((request) => (
        <article key={request.id} className="card stack">
          <div className="row">
            <strong>{PRIVACY_TYPE[request.type]}</strong>
            <span className={`badge ${PRIVACY_STATUS[request.status].badge}`}>
              {PRIVACY_STATUS[request.status].label}
            </span>
            <small className="muted">recebida em {formatDateTime(request.createdAt)}</small>
          </div>
          {request.user ? (
            <span>
              {request.user.name} · {request.user.email}
            </span>
          ) : null}
          {request.details ? <p style={{ margin: 0 }}>{request.details}</p> : null}
          {request.resolution ? (
            <small>
              Resposta ({request.handledBy ?? '—'}, {formatDateTime(request.handledAt)}):{' '}
              {request.resolution}
            </small>
          ) : null}
          {request.status === 'OPEN' || request.status === 'IN_PROGRESS' ? (
            <div className="row">
              {request.status === 'OPEN' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAction({ request, kind: 'IN_PROGRESS' })}
                >
                  Iniciar atendimento
                </button>
              ) : null}
              {request.type === 'ERASURE' ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setAction({ request, kind: 'ANONYMIZE' })}
                >
                  Anonimizar conta
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAction({ request, kind: 'COMPLETED' })}
                >
                  Concluir
                </button>
              )}
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setAction({ request, kind: 'REJECTED' })}
              >
                Recusar
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {list.data ? (
        <Pagination
          page={list.data.meta.page}
          pageSize={list.data.meta.pageSize}
          total={list.data.meta.total}
          onChange={setPage}
        />
      ) : null}
      <ConfirmDialog
        open={action !== null}
        title={
          action?.kind === 'ANONYMIZE'
            ? 'Anonimizar conta'
            : action?.kind === 'REJECTED'
              ? 'Recusar solicitação'
              : action?.kind === 'COMPLETED'
                ? 'Concluir solicitação'
                : 'Iniciar atendimento'
        }
        description={
          action?.kind === 'ANONYMIZE'
            ? 'Irreversível: nome, e-mail, telefone e senha são substituídos, sessões encerradas, mensagens do fórum apagadas e o cadastro de atleta desvinculado. Pedidos, pagamentos e auditoria permanecem. Contas com papel administrativo precisam perder os papéis antes.'
            : 'O titular é avisado da resposta.'
        }
        confirmLabel="Confirmar"
        danger={action?.kind === 'ANONYMIZE' || action?.kind === 'REJECTED'}
        requireReason={action?.kind !== 'IN_PROGRESS'}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (!action) {
            return;
          }

          await api(
            action.kind === 'ANONYMIZE'
              ? `/privacy-requests/${action.request.id}/anonymize`
              : `/privacy-requests/${action.request.id}`,
            action.kind === 'ANONYMIZE'
              ? { method: 'POST', body: { reason } }
              : {
                  method: 'PUT',
                  body: { status: action.kind, ...(reason ? { resolution: reason } : {}) }
                }
          );
          await list.reload();
        }}
      />
    </>
  );
}
