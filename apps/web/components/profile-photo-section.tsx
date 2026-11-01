'use client';

import { useId, useRef, useState } from 'react';

import { api } from '../lib/api-client';
import type { Profile } from '../lib/api-types';
import { useAuth } from '../lib/auth-context';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { Alert, ErrorSummary, useSubmit } from './ui';

const MAX_BYTES = 10 * 1024 * 1024;

interface Job {
  readonly run: () => Promise<unknown>;
  readonly message: string;
}

/**
 * Foto de perfil e perfil público na conta (PEN-062, DT-044, DT-084). Atleta aparece no
 * elenco do site com nome e posição; a foto fica privada até a pessoa marcar o perfil
 * público. Para menor de 18, o site só mostra depois da autorização do responsável.
 */
export function ProfilePhotoSection({ profile }: { readonly profile: Profile }) {
  const { reloadProfile } = useAuth();
  const inputId = useId();
  const [tooLarge, setTooLarge] = useState(false);
  const job = useRef<Job | null>(null);
  const action = useSubmit(async () => {
    const current = job.current;

    if (!current) {
      return;
    }

    await current.run();
    await reloadProfile();
    action.setMessage(current.message);
  });

  function start(run: Job['run'], message: string) {
    job.current = { run, message };
    void action.submit();
  }

  // Elenco (DT-084): atleta aparece com nome e posição; a foto só com o perfil público.
  const status = !profile.publicProfile.isAthlete
    ? profile.profilePublic
      ? 'Público. Você não aparece no elenco porque a conta não está ligada a um cadastro de atleta.'
      : 'Privado: a foto só aparece para você e para a diretoria.'
    : profile.publicProfile.needsGuardianConsent
      ? 'Fora do elenco por enquanto: para menores de 18 anos, o responsável precisa autorizar junto à diretoria.'
      : !profile.publicProfile.visibleOnSite
        ? 'Você aparece no elenco quando estiver com status Ativo em uma equipe.'
        : profile.profilePublic
          ? 'Público: você aparece no elenco do seu time em Times, com a sua foto.'
          : 'Privado: você aparece no elenco com nome e posição, e a logo do Fênix no lugar da foto.';

  return (
    <section className="card stack" aria-labelledby="foto">
      <h2 id="foto">
        <Icon name="person-badge" className="icon-lead" /> Foto e perfil público
      </h2>
      {action.message ? <Alert kind="success">{action.message}</Alert> : null}
      <ErrorSummary error={action.error} />
      <div className="row">
        <Avatar src={profile.avatarUrl} name={profile.name} size={96} authenticated />
        <div className="stack gap-sm flex-16">
          <label htmlFor={inputId} className="label fw-semibold">
            {profile.avatarUrl ? 'Trocar foto' : 'Enviar foto'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={action.pending}
            onChange={(event) => {
              const file = event.target.files?.[0];

              event.target.value = '';
              setTooLarge(file !== undefined && file.size > MAX_BYTES);

              if (!file || file.size > MAX_BYTES) {
                return;
              }

              const body = new FormData();

              body.append('file', file);
              start(() => api<Profile>('/me/avatar', { method: 'PUT', body }), 'Foto atualizada.');
            }}
          />
          <span className="field-hint">
            PNG, JPG ou WebP, até 10 MB. Prefira uma foto de rosto, com boa luz.
          </span>
          {tooLarge ? (
            <span className="field-error">A foto passa de 10 MB. Escolha um arquivo menor.</span>
          ) : null}
          {profile.avatarUrl ? (
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={action.pending}
                onClick={() =>
                  start(() => api<Profile>('/me/avatar', { method: 'DELETE' }), 'Foto removida.')
                }
              >
                <Icon name="trash" /> Remover foto
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {profile.minorAccount ? (
        <p className="muted m-0">
          <Icon name="lock" /> Seu perfil fica privado enquanto você for menor de idade: a foto não
          aparece para outras pessoas nem no elenco. Isso muda quando você completar 18 anos.
        </p>
      ) : (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={profile.profilePublic}
            disabled={action.pending}
            onChange={(event) => {
              const value = event.target.checked;

              start(
                () =>
                  api<Profile>('/me/profile-visibility', {
                    method: 'PUT',
                    body: { public: value }
                  }),
                value ? 'Perfil público ativado.' : 'Seu perfil agora é privado.'
              );
            }}
          />
          <span>
            <strong>Perfil público.</strong> Qualquer pessoa pode ver minha foto e, se eu for atleta
            do time, ela aparece no elenco em Times (sem ela, aparece a logo do Fênix). Idade e
            contato nunca aparecem.
          </span>
        </label>
      )}
      <p className="muted m-0" aria-live="polite">
        {action.pending ? 'Salvando…' : status}
      </p>
    </section>
  );
}
