'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert, ConfirmDialog, TextArea } from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import { downloadProtectedFile } from '../../../../lib/download';
import { formatDateTime } from '../../../../lib/format';
import { PRIVACY_STATUS, PRIVACY_TYPE, type PrivacyRequest } from '../../../../lib/privacy-types';
import { useResource } from '../../../../lib/use-resource';

/** Direitos do titular: cópia dos dados e pedido de eliminação (LGPD art. 18). */
export default function MyPrivacyPage() {
  const requests = useResource<PrivacyRequest[]>('/me/privacy/requests');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [details, setDetails] = useState('');

  async function exportData() {
    setError(null);

    try {
      await downloadProtectedFile('/me/privacy/export', 'meus-dados-fenix.json');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <h1>Privacidade e dados</h1>
      <p className="muted">
        Veja como tratamos seus dados na <Link href="/privacidade">política de privacidade</Link>.
      </p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <section className="card stack" aria-labelledby="copia">
        <h2 id="copia" style={{ margin: 0 }}>
          Cópia dos seus dados
        </h2>
        <p style={{ margin: 0 }}>
          Baixe um arquivo com seus dados de conta, atleta, inscrições, pedidos, agendamentos,
          mensagens e notificações. Senhas e dados de outras pessoas não são incluídos.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ justifySelf: 'start' }}
          onClick={() => void exportData()}
        >
          Baixar meus dados
        </button>
      </section>

      <section className="card stack" aria-labelledby="eliminacao">
        <h2 id="eliminacao" style={{ margin: 0 }}>
          Excluir minha conta
        </h2>
        <p style={{ margin: 0 }}>
          A diretoria analisa o pedido e anonimiza sua conta. Pedidos, pagamentos e registros com
          obrigação legal de guarda são mantidos pelo prazo exigido, sem uso para outras
          finalidades.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          style={{ justifySelf: 'start' }}
          onClick={() => setErasing(true)}
        >
          Pedir exclusão
        </button>
      </section>

      {requests.data && requests.data.length > 0 ? (
        <section className="card stack" aria-labelledby="pedidos">
          <h2 id="pedidos" style={{ margin: 0 }}>
            Seus pedidos
          </h2>
          <ul style={{ margin: 0 }}>
            {requests.data.map((request) => (
              <li key={request.id}>
                {PRIVACY_TYPE[request.type]} · {formatDateTime(request.createdAt)} ·{' '}
                <span className={`badge ${PRIVACY_STATUS[request.status].badge}`}>
                  {PRIVACY_STATUS[request.status].label}
                </span>
                {request.resolution ? <p style={{ margin: 0 }}>{request.resolution}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={erasing}
        title="Pedir exclusão da conta"
        description="Depois de atendido, você perde o acesso e não é possível desfazer."
        confirmLabel="Enviar pedido"
        danger
        onClose={() => setErasing(false)}
        onConfirm={async () => {
          await api('/me/privacy/requests', {
            method: 'POST',
            body: { type: 'ERASURE', ...(details.trim() ? { details } : {}) }
          });
          setNotice('Pedido enviado. Você será avisado da resposta.');
          setDetails('');
          await requests.reload();
        }}
      >
        <TextArea
          label="Observação (opcional)"
          maxLength={2000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
