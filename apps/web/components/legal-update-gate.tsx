'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api-client';
import type { PublicTeam } from '../lib/api-types';
import { useAuth } from '../lib/auth-context';
import { TEAM_TIME_ZONE } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { ErrorSummary, useSubmit } from './ui';

const TITLES = {
  termsOfUse: { label: 'Termos de uso', href: '/termos' },
  privacyPolicy: { label: 'Política de privacidade', href: '/privacidade' }
} as const;

function since(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TEAM_TIME_ZONE }).format(
    new Date(iso)
  );
}

/**
 * Versão nova dos termos ou da política (DT-094): quem já tem conta lê e aceita antes de
 * continuar. O diálogo não fecha com Esc; a alternativa a aceitar é sair da conta.
 */
export function LegalUpdateGate() {
  const { status, profile, reloadProfile, logout } = useAuth();
  const pending = status === 'authenticated' ? (profile?.pendingLegal ?? []) : [];
  const open = pending.length > 0;
  const team = useResource<PublicTeam>(open ? '/public/team' : null);
  const ref = useRef<HTMLDialogElement>(null);
  const [agreed, setAgreed] = useState(false);
  const accept = useSubmit(async () => {
    try {
      await api('/me/legal-acceptances', {
        method: 'POST',
        body: {
          ...(team.data?.legalVersions?.termsOfUse
            ? { termsVersionId: team.data.legalVersions.termsOfUse.id }
            : {}),
          ...(team.data?.legalVersions?.privacyPolicy
            ? { privacyVersionId: team.data.legalVersions.privacyPolicy.id }
            : {})
        }
      });
    } finally {
      // Texto trocado no meio da leitura: busca as versões novas e mostra de novo.
      setAgreed(false);
      await Promise.all([team.reload(), reloadProfile()]);
    }
  });

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal?.();
    } else if (!open && dialog.open) {
      dialog.close?.();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="legal-update"
      aria-labelledby="termos-atualizados"
      onCancel={(event) => event.preventDefault()}
    >
      {open ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void accept.submit();
          }}
        >
          <h2 id="termos-atualizados" className="m-0">
            Atualizamos {pending.length > 1 ? 'nossos documentos' : 'um documento'}
          </h2>
          <p className="m-0">Para continuar usando a sua conta, leia e aceite a versão nova:</p>
          <ul className="stack gap-xs m-0">
            {pending.map((item) => (
              <li key={item.id}>
                <Link href={TITLES[item.field].href} target="_blank">
                  {TITLES[item.field].label}
                </Link>{' '}
                <span className="muted">
                  (versão {item.version}, em vigor desde {since(item.publishedAt)})
                </span>
              </li>
            ))}
          </ul>
          <ErrorSummary error={accept.error} />
          <label className="checkbox">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>Li e aceito a versão nova.</span>
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={accept.pending || !team.data}
            >
              {accept.pending ? 'Salvando…' : 'Aceitar e continuar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
              Sair da conta
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
