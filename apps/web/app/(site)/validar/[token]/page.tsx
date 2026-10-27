'use client';

import { useParams } from 'next/navigation';

import { Avatar } from '../../../../components/avatar';
import { Icon } from '../../../../components/icon';
import { Alert, Loading } from '../../../../components/ui';
import { useAuth } from '../../../../lib/auth-context';
import {
  type Benefit,
  CARD_TYPE,
  type PublicValidation,
  type StaffValidation
} from '../../../../lib/card-types';
import { formatDate, formatDateTime } from '../../../../lib/format';
import { useResource } from '../../../../lib/use-resource';

function Benefits({ items }: { readonly items: readonly Benefit[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="beneficios">
      <h2 id="beneficios" style={{ margin: 0 }}>
        Benefícios desta carteirinha
      </h2>
      <ul className="stack" style={{ gap: '0.4rem', paddingLeft: '1.1rem', margin: 0 }}>
        {items.map((b) => (
          <li key={b.id}>
            <strong>{b.discountPercent}%</strong> em <strong>{b.partner.name}</strong>: {b.title}
            {b.conditions ? <span className="muted"> ({b.conditions})</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Verdict({ valid, label }: { readonly valid: boolean; readonly label: string }) {
  return (
    <div
      className={`card-check ${valid ? 'card-check-valid' : 'card-check-invalid'}`}
      role="status"
    >
      <Icon name={valid ? 'check-circle-fill' : 'x-octagon-fill'} />
      <h1>{valid ? 'VÁLIDA' : 'INVÁLIDA'}</h1>
      {valid || label === 'Inválida' ? null : <p style={{ margin: 0 }}>{label}</p>}
    </div>
  );
}

/** Quem confere sem login (loja parceira): o mínimo para conferir (DT-068 C). */
function PublicCheck({ token }: { readonly token: string }) {
  const result = useResource<PublicValidation>(
    `/public/cards/validate/${encodeURIComponent(token)}`
  );

  if (!result.data) {
    return result.error ? <Alert kind="error">{result.error}</Alert> : <Loading />;
  }

  const { valid, label, card, checkedAt } = result.data;

  return (
    <>
      <Verdict valid={valid} label={label} />
      {card ? (
        <section className="card row" aria-label="Titular">
          <Avatar src={card.photo} name={card.name} size={96} />
          <div className="stack" style={{ gap: '0.25rem' }}>
            <strong style={{ fontSize: '1.4rem' }}>{card.name}</strong>
            <span>Carteirinha de {CARD_TYPE[card.type].toLowerCase()}</span>
            {card.endsOn ? <span>Válida até {formatDate(card.endsOn)}</span> : null}
            {card.minorWithoutPhoto ? (
              <Alert kind="warning">Menor de idade: confira um documento com foto.</Alert>
            ) : null}
          </div>
        </section>
      ) : null}
      {card ? <Benefits items={card.benefits} /> : null}
      <p className="muted">Conferido em {formatDateTime(checkedAt)}.</p>
    </>
  );
}

/** Diretoria logada: situação completa, equipes e, com permissão, mensalidade. */
function StaffCheck({ token }: { readonly token: string }) {
  const result = useResource<StaffValidation>(`/cards/validate/${encodeURIComponent(token)}`);

  if (!result.data) {
    return result.error ? <Alert kind="error">{result.error}</Alert> : <Loading />;
  }

  const { valid, label, card, checkedAt } = result.data;

  return (
    <>
      <Verdict valid={valid} label={label} />
      {card ? (
        <section className="card row" aria-label="Titular">
          <Avatar src={card.photo} name={card.holderName} size={96} />
          <div className="stack" style={{ gap: '0.25rem' }}>
            <strong style={{ fontSize: '1.4rem' }}>{card.holderName}</strong>
            <span>
              {CARD_TYPE[card.type]} · {card.code} · {card.stateLabel}
            </span>
            {card.team ? <span>Equipe: {card.team.name}</span> : null}
            {card.endsOn ? <span>Válida até {formatDate(card.endsOn)}</span> : null}
            {card.feesUpToDate === null ? null : (
              <span className={`badge ${card.feesUpToDate ? 'badge-success' : 'badge-warning'}`}>
                {card.feesUpToDate ? 'Mensalidades em dia' : 'Há mensalidade vencida'}
              </span>
            )}
          </div>
        </section>
      ) : null}
      {card ? <Benefits items={card.benefits} /> : null}
      <p className="muted">Conferido em {formatDateTime(checkedAt)} (registrado).</p>
    </>
  );
}

export default function ValidateCardPage() {
  const { token } = useParams<{ token: string }>();
  const { status, can } = useAuth();

  return (
    <div className="container stack" style={{ paddingTop: '2rem', maxWidth: '40rem' }}>
      {status === 'loading' ? (
        <Loading />
      ) : status === 'authenticated' && can('cards.read') ? (
        <StaffCheck token={token} />
      ) : (
        <PublicCheck token={token} />
      )}
    </div>
  );
}
