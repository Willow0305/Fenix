'use client';

import { useState } from 'react';

import { api } from '../lib/api-client';
import type { Team } from '../lib/sports-types';
import { BrandLogo } from './brand-logo';
import { Icon } from './icon';
import { ErrorSummary, useSubmit } from './ui';

/**
 * Logo própria da equipe (DT-064): aparece no site em Times e nos cartões do Início. Sem
 * logo, o site usa o brasão oficial de Configurações.
 */
export function TeamLogoUpload({
  team,
  onChanged
}: {
  readonly team: Team;
  readonly onChanged: (team: Team) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const upload = useSubmit(async () => {
    if (!file) {
      return;
    }

    const form = new FormData();

    form.set('file', file);
    const saved = await api<Team>(`/teams/${team.id}/logo`, { method: 'PUT', body: form });

    setFile(null);
    setInputKey((key) => key + 1);
    upload.setMessage('Logo atualizada.');
    await onChanged(saved);
  });
  const remove = useSubmit(async () => {
    const saved = await api<Team>(`/teams/${team.id}/logo`, { method: 'DELETE' });

    remove.setMessage('Logo removida; o site volta a usar o brasão oficial.');
    await onChanged(saved);
  });

  return (
    <form className="stack" onSubmit={(event) => void upload.submit(event)}>
      <strong>Logo do time</strong>
      <div className="row">
        <BrandLogo src={team.logoUrl ?? undefined} alt={`Logo de ${team.name}`} size={88} />
        <span className="muted">
          {team.logoUrl
            ? 'Mostrada na página Times e nos cartões do Início.'
            : 'Sem logo própria: o site usa o brasão oficial.'}
        </span>
      </div>
      <ErrorSummary error={upload.error ?? remove.error} />
      {upload.message || remove.message ? (
        <p className="muted" role="status">
          {upload.message ?? remove.message}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={`logo-${team.id}`}>Arquivo (PNG, JPG ou WebP, até 5 MB)</label>
        <input
          key={inputKey}
          id={`logo-${team.id}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-secondary" disabled={!file || upload.pending}>
          <Icon name="upload" /> {upload.pending ? 'Enviando…' : 'Enviar logo'}
        </button>
        {team.logoUrl ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={remove.pending}
            onClick={() => void remove.submit()}
          >
            <Icon name="trash" /> Remover logo
          </button>
        ) : null}
      </div>
    </form>
  );
}
