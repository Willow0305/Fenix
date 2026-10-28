'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import {
  ATTEMPT_STATUS,
  type Courier,
  COURIER_KIND,
  type CourierKind,
  courierMessage,
  type DeliveryAttempt,
  PROOF_KIND
} from '../lib/delivery-types';
import { formatDateTime, formatPhoneDisplay } from '../lib/format';
import type { Order } from '../lib/store-types';
import { useResource } from '../lib/use-resource';
import { Icon } from './icon';
import { Alert, ConfirmDialog, ErrorSummary, SelectField, TextField, useSubmit } from './ui';

const OTHER = 'outro';

interface DispatchForm {
  courierId: string;
  courierKind: CourierKind;
  courierName: string;
  courierPhone: string;
  vehicle: string;
  plate: string;
  notes: string;
}

const EMPTY: DispatchForm = {
  courierId: '',
  courierKind: 'OWN_COURIER',
  courierName: '',
  courierPhone: '',
  vehicle: '',
  plate: '',
  notes: ''
};

/** Link do entregador com copiar e WhatsApp (o link só aparece ao gerar). */
function CourierLinkBox({
  link,
  orderNumber,
  phone
}: {
  readonly link: string;
  readonly orderNumber: string;
  readonly phone: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const text = courierMessage(orderNumber, link);
  const digits = phone?.replace(/\D/g, '') ?? '';

  return (
    <Alert kind="info">
      <div className="stack gap-sm">
        <strong>Link do entregador (vale 24 horas):</strong>
        <code className="text-break">{link}</code>
        <div className="row gap-sm">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
          >
            <Icon name="clipboard" /> {copied ? 'Copiado!' : 'Copiar mensagem'}
          </button>
          <a
            className="btn btn-secondary btn-sm"
            href={`https://wa.me/${digits ? `55${digits}` : ''}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="whatsapp" /> Enviar pelo WhatsApp
          </a>
        </div>
        <small>
          Sem o link, o entregador pode só perguntar os 4 números ao cliente e passar para você
          digitar abaixo.
        </small>
      </div>
    </Alert>
  );
}

/**
 * Quadro "Entrega" do pedido com entrega em casa (DT-075): saída com entregador, link do
 * motoboy, código e foto, tentativa sem sucesso, troca para retirada e "Não recebi".
 */
export function DispatchPanel({
  order,
  onChanged
}: {
  readonly order: Order;
  readonly onChanged: () => Promise<void> | void;
}) {
  const { can } = useAuth();
  const manage = can('orders.status.change');
  const attempts = useResource<DeliveryAttempt[]>(`/store/orders/${order.id}/delivery-attempts`);
  const couriers = useResource<Courier[]>(manage ? '/store/couriers' : null);
  const [form, setForm] = useState<DispatchForm>(EMPTY);
  const [link, setLink] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [dialog, setDialog] = useState<
    'failed' | 'pickup' | 'REDELIVER' | 'REFUND' | 'KEEP' | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = attempts.data?.find((attempt) => attempt.status === 'OUT') ?? null;
  const refresh = async () => {
    await Promise.all([attempts.reload(), onChanged()]);
  };
  const set = (key: keyof DispatchForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  const dispatch = useSubmit(async () => {
    const other = form.courierId === OTHER || form.courierId === '';
    const result = await api<{ link: string }>(`/store/orders/${order.id}/dispatch`, {
      method: 'POST',
      body: other
        ? Object.fromEntries(
            Object.entries({
              courierKind: form.courierId === OTHER ? form.courierKind : '',
              courierName: form.courierName,
              courierPhone: form.courierPhone,
              vehicle: form.vehicle,
              plate: form.plate,
              notes: form.notes
            }).filter(([, value]) => value.trim() !== '')
          )
        : { courierId: form.courierId, ...(form.notes.trim() ? { notes: form.notes } : {}) }
    });

    setLink(result.link);
    setForm(EMPTY);
    setNotice('Saiu para entrega. O comprador recebeu o aviso com o código.');
    await refresh();
  });
  const rotate = useSubmit(async () => {
    setLink(
      (await api<{ link: string }>(`/store/orders/${order.id}/dispatch/link`, { method: 'POST' }))
        .link
    );
  });
  const confirmCode = useSubmit(async () => {
    await api(`/store/orders/${order.id}/delivery-code`, { method: 'POST', body: { code } });
    setCode('');
    setLink(null);
    setNotice('Código confere: entrega comprovada.');
    await refresh();
  });
  const sendPhoto = useSubmit(async () => {
    if (!photo) {
      return;
    }

    const body = new FormData();

    body.set('file', photo);

    if (receivedBy.trim()) {
      body.set('receivedBy', receivedBy.trim());
    }

    await api(`/store/orders/${order.id}/delivery-photo`, { method: 'POST', body });
    setPhoto(null);
    setReceivedBy('');
    setLink(null);
    setNotice('Foto anexada: entrega comprovada.');
    await refresh();
  });

  if (order.fulfillment !== 'DELIVERY' && (attempts.data?.length ?? 0) === 0) {
    return null;
  }

  const canDispatch =
    manage &&
    order.fulfillment === 'DELIVERY' &&
    (order.status === 'PAID' || order.status === 'PROCESSING');
  const failedBefore = (attempts.data ?? []).some((attempt) => attempt.status === 'FAILED');
  const openDispute = order.notReceivedAt !== null && order.notReceivedResolution === null;
  const selected = couriers.data?.find((c) => c.id === form.courierId) ?? null;

  return (
    <section className="card stack" aria-labelledby="quadro-entrega">
      <div className="row">
        <h2 id="quadro-entrega" className="m-0">
          <Icon name="truck" /> Entrega
        </h2>
        <span className="spacer" />
        {order.deliveryProofKind ? (
          <span className={`badge ${PROOF_KIND[order.deliveryProofKind].badge}`}>
            Prova: {PROOF_KIND[order.deliveryProofKind].label}
          </span>
        ) : null}
      </div>
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      {openDispute ? (
        <Alert kind="warning">
          <div className="stack gap-sm">
            <strong>
              O comprador avisou que não recebeu ({formatDateTime(order.notReceivedAt)}).
            </strong>
            {order.notReceivedNote ? <span>&quot;{order.notReceivedNote}&quot;</span> : null}
            {manage ? (
              <div className="row gap-sm">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setDialog('REDELIVER')}
                >
                  Entregar de novo
                </button>
                {can('payments.correct') ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setDialog('REFUND')}
                  >
                    Estornar pedido
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDialog('KEEP')}
                >
                  Manter como entregue
                </button>
              </div>
            ) : null}
          </div>
        </Alert>
      ) : null}

      {order.status === 'DELIVERED' && order.deliveryProofKind === 'STAFF_ONLY' && !openDispute ? (
        <p className="muted m-0">
          Entregue sem prova: o comprador pode avisar &quot;Não recebi&quot;
          {order.notReceivedUntil ? ` até ${formatDateTime(order.notReceivedUntil)}` : ''}. Anexe a
          foto ou peça o &quot;Recebi&quot; para comprovar.
        </p>
      ) : null}

      {link ? (
        <CourierLinkBox
          link={link}
          orderNumber={order.orderNumber}
          phone={current?.courierPhone ?? null}
        />
      ) : null}

      {canDispatch ? (
        <form className="form" onSubmit={(event) => void dispatch.submit(event)}>
          <h3 className="h-small m-0">Saiu para entrega</h3>
          <p className="muted m-0">
            Tudo é opcional. O comprador recebe o aviso com o código de 4 dígitos e vê o primeiro
            nome, o veículo e a placa de quem leva.
          </p>
          <ErrorSummary error={dispatch.error} />
          <div className="form-grid">
            <SelectField
              label="Quem leva"
              value={form.courierId}
              onChange={set('courierId')}
              options={[
                { value: '', label: 'Não informar' },
                ...(couriers.data ?? [])
                  .filter((c) => c.isActive)
                  .map((c) => ({
                    value: c.id,
                    label: `${c.name} · ${COURIER_KIND[c.kind]}${c.plate ? ` · ${c.plate}` : ''}`
                  })),
                { value: OTHER, label: 'Outro (digitar agora)' }
              ]}
            />
            {form.courierId === OTHER ? (
              <>
                <SelectField
                  label="Tipo"
                  value={form.courierKind}
                  onChange={set('courierKind')}
                  options={Object.entries(COURIER_KIND).map(([value, label]) => ({
                    value,
                    label
                  }))}
                />
                <TextField
                  label="Nome"
                  maxLength={120}
                  value={form.courierName}
                  onChange={set('courierName')}
                />
                <TextField
                  label="Telefone"
                  maxLength={30}
                  value={form.courierPhone}
                  onChange={set('courierPhone')}
                  hint="Só a diretoria vê."
                />
                <TextField
                  label="Veículo"
                  maxLength={60}
                  value={form.vehicle}
                  onChange={set('vehicle')}
                  placeholder="Moto vermelha"
                />
                <TextField
                  label="Placa"
                  maxLength={10}
                  value={form.plate}
                  onChange={set('plate')}
                />
              </>
            ) : null}
          </div>
          {selected ? (
            <p className="muted m-0">
              {[selected.vehicle, selected.plate, formatPhoneDisplay(selected.phone)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          <TextField
            label="Observação (opcional)"
            maxLength={500}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Sai às 14h, rota Centro"
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={dispatch.pending}>
              <Icon name="truck" /> Registrar saída para entrega
            </button>
            {failedBefore ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDialog('pickup')}
              >
                Trocar para retirada
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {manage && order.status === 'OUT_FOR_DELIVERY' && current ? (
        <div className="stack">
          <p className="m-0">
            A caminho desde {formatDateTime(current.dispatchedAt)}
            {current.courierName ? ` com ${current.courierName}` : ''}
            {current.plate ? ` (placa ${current.plate})` : ''}.{' '}
            {current.linkActive ? 'Link ativo.' : 'Link vencido.'}
          </p>
          <div className="row gap-sm">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={rotate.pending}
              onClick={() => void rotate.submit()}
            >
              <Icon name="link-45deg" /> Gerar novo link
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDialog('failed')}
            >
              Não deu certo
            </button>
          </div>
          <ErrorSummary error={rotate.error} />
          <form className="row" onSubmit={(event) => void confirmCode.submit(event)}>
            <TextField
              label="Código que o cliente informou"
              numeric="integer"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hint="O código não aparece aqui: o entregador pergunta ao cliente."
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={code.length !== 4 || confirmCode.pending}
            >
              Confirmar entrega
            </button>
            <ErrorSummary error={confirmCode.error} />
          </form>
          <form className="row" onSubmit={(event) => void sendPhoto.submit(event)}>
            <div className="field">
              <label htmlFor="foto-saida">Foto da entrega (o motoboy mandou depois)</label>
              <input
                id="foto-saida"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </div>
            <TextField
              label="Quem recebeu (opcional)"
              maxLength={120}
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Maria, mãe"
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!photo || sendPhoto.pending}
            >
              Anexar foto
            </button>
            <ErrorSummary error={sendPhoto.error} />
          </form>
        </div>
      ) : null}

      {(attempts.data ?? []).length > 0 ? (
        <details className="collapsible">
          <summary>Saídas para entrega ({attempts.data?.length})</summary>
          <ul className="stack list-plain">
            {(attempts.data ?? []).map((attempt) => (
              <li key={attempt.id} className="stack gap-sm">
                <div className="row gap-sm">
                  <span className={`badge ${ATTEMPT_STATUS[attempt.status].badge}`}>
                    {ATTEMPT_STATUS[attempt.status].label}
                  </span>
                  <span>{formatDateTime(attempt.dispatchedAt)}</span>
                  {attempt.dispatchedBy ? (
                    <span className="muted">por {attempt.dispatchedBy}</span>
                  ) : null}
                </div>
                <span className="muted">
                  {[
                    attempt.courierKind ? COURIER_KIND[attempt.courierKind] : null,
                    attempt.courierName,
                    attempt.courierPhone ? formatPhoneDisplay(attempt.courierPhone) : null,
                    attempt.vehicle,
                    attempt.plate
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Entregador não informado'}
                </span>
                {attempt.notes ? <span className="muted">Obs.: {attempt.notes}</span> : null}
                {attempt.receivedBy ? <span>Recebido por: {attempt.receivedBy}</span> : null}
                {attempt.hasPhoto ? <span>Foto anexada</span> : null}
                {attempt.codeAttempts > 0 ? (
                  <span className="muted">Códigos errados: {attempt.codeAttempts}</span>
                ) : null}
                {attempt.failureReason ? (
                  <span className="muted">Motivo: {attempt.failureReason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ConfirmDialog
        open={dialog === 'failed'}
        title="Entrega sem sucesso"
        description="O pedido volta para separação. Depois, registre uma nova saída ou troque para retirada."
        confirmLabel="Registrar"
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/store/orders/${order.id}/status`, {
            method: 'PUT',
            body: { status: 'PROCESSING', reason }
          });
          setLink(null);
          setNotice('Tentativa registrada. O comprador foi avisado.');
          await refresh();
        }}
      />
      <ConfirmDialog
        open={dialog === 'pickup'}
        title="Trocar para retirada"
        description="O pedido passa a ser retirado com o Fênix e o comprador é avisado. A taxa de entrega não é devolvida (é paga uma vez por pedido)."
        confirmLabel="Trocar"
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/store/orders/${order.id}/switch-to-pickup`, {
            method: 'POST',
            body: { reason }
          });
          setNotice('Pedido trocado para retirada.');
          await refresh();
        }}
      ></ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'REDELIVER' || dialog === 'REFUND' || dialog === 'KEEP'}
        title={
          dialog === 'REDELIVER'
            ? 'Entregar de novo'
            : dialog === 'REFUND'
              ? 'Estornar pedido'
              : 'Manter como entregue'
        }
        description={
          dialog === 'REDELIVER'
            ? 'O pedido volta para separação para uma nova saída.'
            : dialog === 'REFUND'
              ? 'Tudo o que foi pago, inclusive a entrega, é estornado com saída no Caixa.'
              : 'Use quando houver prova da entrega (ex.: foto que chegou depois). A resposta vai para o comprador.'
        }
        confirmLabel="Confirmar"
        danger={dialog === 'REFUND'}
        requireReason
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api(`/store/orders/${order.id}/not-received/resolve`, {
            method: 'POST',
            body: { action: dialog, reason }
          });
          setNotice('Aviso de "Não recebi" respondido.');
          await refresh();
        }}
      />
    </section>
  );
}
