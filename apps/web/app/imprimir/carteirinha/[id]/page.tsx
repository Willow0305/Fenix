'use client';

import { useParams } from 'next/navigation';

import { Icon } from '../../../../components/icon';
import { MemberCardFront, QrImage } from '../../../../components/member-card';
import { RequireAuth } from '../../../../components/require-auth';
import { Alert, Loading } from '../../../../components/ui';
import type { CardDesign, CardQr, MemberCard } from '../../../../lib/card-types';
import { useResource } from '../../../../lib/use-resource';

type Printable = MemberCard & CardQr & { design: CardDesign };

/**
 * Carteirinha para imprimir (DT-068): frente e verso no tamanho de cartão. O QR impresso é
 * fixo e vale até a diretoria reemitir a carteirinha.
 */
function PrintableCard() {
  const { id } = useParams<{ id: string }>();
  const card = useResource<Printable>(`/me/cards/${id}/print`);

  if (!card.data) {
    return card.error ? <Alert kind="error">{card.error}</Alert> : <Loading />;
  }

  const c = card.data;

  return (
    <div className="stack" style={{ padding: '1.5rem', alignItems: 'flex-start' }}>
      <div className="no-print stack" style={{ maxWidth: '40rem' }}>
        <h1 style={{ margin: 0 }}>Imprimir carteirinha</h1>
        <p className="muted" style={{ margin: 0 }}>
          Imprima em tamanho real (100%, sem ajustar à página), recorte e plastifique se quiser. O
          QR impresso vale até a diretoria reemitir a carteirinha; se perder, peça a reemissão.
        </p>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="printer" /> Imprimir
          </button>
        </div>
      </div>
      <MemberCardFront card={c} design={c.design} />
      <article className={`member-card member-card-${c.design.template.toLowerCase()}`}>
        <div className="member-card-body" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="member-card-info">
            <strong>Uso pessoal e intransferível</strong>
            <span>Apresente com documento com foto quando pedido.</span>
            <span>Para conferir, aponte a câmera para o QR.</span>
            <span className="member-card-code">{c.code}</span>
          </div>
          <div className="member-card-qr">
            <QrImage svg={c.qrSvg} label={`QR impresso da carteirinha ${c.code}`} />
          </div>
        </div>
      </article>
    </div>
  );
}

export default function PrintCardPage() {
  return (
    <RequireAuth>
      <PrintableCard />
    </RequireAuth>
  );
}
