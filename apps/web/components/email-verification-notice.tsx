'use client';

import { api } from '../lib/api-client';
import type { Profile } from '../lib/api-types';
import { Icon } from './icon';
import { ErrorSummary, useSubmit } from './ui';

/** Aviso em Minha conta enquanto o e-mail não estiver confirmado (DT-096). */
export function EmailVerificationNotice({ profile }: { readonly profile: Profile }) {
  const resend = useSubmit(async () => {
    const { message } = await api<{ message: string }>('/me/email-verification', {
      method: 'POST'
    });

    resend.setMessage(message);
  });

  if (profile.emailVerified !== false) {
    return null;
  }

  return (
    <section className="alert alert-info stack gap-sm" aria-labelledby="confirmar-email">
      <strong id="confirmar-email">
        <Icon name="envelope-check" /> Confirme seu e-mail
      </strong>
      <p className="m-0">
        Enviamos um link para <strong>{profile.email}</strong>. Confirmando, as compras feitas na
        loja sem conta com este e-mail passam para a sua conta. Não achou? Olhe a caixa de spam.
      </p>
      <ErrorSummary error={resend.error} />
      {resend.message ? (
        <p className="m-0" role="status">
          {resend.message}
        </p>
      ) : (
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={resend.pending}
            onClick={() => void resend.submit()}
          >
            {resend.pending ? 'Enviando…' : 'Reenviar o link'}
          </button>
        </div>
      )}
    </section>
  );
}
