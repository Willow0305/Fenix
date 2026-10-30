'use client';

import { useState } from 'react';

import { api, errorMessage } from '../lib/api-client';
import type { Team } from '../lib/sports-types';
import { Icon } from './icon';
import { ImageCropDialog } from './image-crop-dialog';
import { Alert } from './ui';

/**
 * Foto do time (D2, DT-081): aparece no topo do cartão do time em Times e nos cartões do
 * Início. Ao escolher o arquivo, abre o recorte já no formato 3:2. Só fotos com autorização
 * de imagem.
 */
export function TeamPhotoUpload({
  team,
  onChanged
}: {
  readonly team: Team;
  readonly onChanged: (team: Team) => Promise<void> | void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (source) {
      URL.revokeObjectURL(source);
    }

    setSource(null);
    setInputKey((key) => key + 1);
  }

  async function send(blob: Blob) {
    const form = new FormData();

    form.set('file', blob, 'foto.jpg');
    await onChanged(await api<Team>(`/teams/${team.id}/photo`, { method: 'PUT', body: form }));
    setMessage({ kind: 'success', text: 'Foto do time atualizada.' });
    close();
  }

  async function remove() {
    setBusy(true);
    setMessage(null);

    try {
      await onChanged(await api<Team>(`/teams/${team.id}/photo`, { method: 'DELETE' }));
      setMessage({ kind: 'success', text: 'Foto removida; o site mostra só a logo.' });
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <strong>Foto do time</strong>
      {team.photoUrl ? (
        <img className="team-photo-preview" src={team.photoUrl} alt={`Foto de ${team.name}`} />
      ) : (
        <p className="muted m-0">
          Sem foto: o site mostra só a logo. Use foto com autorização de imagem de todos.
        </p>
      )}
      {message ? <Alert kind={message.kind}>{message.text}</Alert> : null}
      <div className="field">
        <label htmlFor={`foto-${team.id}`}>
          {team.photoUrl ? 'Trocar a foto' : 'Enviar foto'} (PNG, JPG ou WebP, até 10 MB)
        </label>
        <input
          key={inputKey}
          id={`foto-${team.id}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              setMessage(null);
              setSource(URL.createObjectURL(file));
            }
          }}
        />
      </div>
      {team.photoUrl ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Icon name="trash" /> Remover foto
          </button>
        </div>
      ) : null}
      <ImageCropDialog
        src={source}
        title={`Foto de ${team.name}`}
        initialAspect={3 / 2}
        onCancel={close}
        onConfirm={send}
      />
    </div>
  );
}
