'use client';

import { useEffect, useId, useState } from 'react';

import { api } from '../lib/api-client';
import { Icon } from './icon';
import { MediaImage, type MediaRatio } from './media-image';
import { Alert, ErrorSummary, useSubmit } from './ui';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Envio de imagem pública no painel (logo, capa): pré-visualização antes de enviar,
 * proporção recomendada, limite de 10 MB conferido já no navegador e mensagem clara.
 * O servidor valida de novo, reduz e converte para WebP (DT-039).
 */
export function ImageUpload<T>({
  title,
  endpoint,
  currentUrl,
  ratio = '16/9',
  recommended,
  onUploaded
}: {
  readonly title: string;
  readonly endpoint: string;
  readonly currentUrl: string | null;
  readonly ratio?: MediaRatio;
  /** Ex.: "1600 × 900 px". */
  readonly recommended: string;
  readonly onUploaded: (result: T) => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const upload = useSubmit(async () => {
    if (!file) {
      return;
    }

    const body = new FormData();

    body.append('file', file);
    onUploaded(await api<T>(endpoint, { method: 'POST', body }));
    setFile(null);
    upload.setMessage('Imagem enviada.');
  });

  useEffect(() => {
    if (!file) {
      setPreview(null);

      return undefined;
    }

    const url = URL.createObjectURL(file);

    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <form className="form card" onSubmit={(event) => void upload.submit(event)}>
      <h2>
        <Icon name="image" className="icon-lead" /> {title}
      </h2>
      {upload.message ? <Alert kind="success">{upload.message}</Alert> : null}
      <ErrorSummary error={upload.error} />
      <div className="image-upload">
        <MediaImage
          src={preview ?? currentUrl}
          alt=""
          ratio={ratio}
          fit={ratio === '1/1' ? 'contain' : 'cover'}
          fallbackTone="light"
        />
        <div className="stack" style={{ gap: '0.5rem' }}>
          <label htmlFor={inputId} className="label" style={{ fontWeight: 600 }}>
            {currentUrl ? 'Trocar imagem' : 'Escolher imagem'}
          </label>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;

              setTooLarge(chosen !== null && chosen.size > MAX_BYTES);
              setFile(chosen !== null && chosen.size <= MAX_BYTES ? chosen : null);
            }}
          />
          <span className="field-hint">
            PNG, JPG ou WebP, até 10 MB. Recomendado: {recommended}. A imagem é otimizada ao enviar.
          </span>
          {tooLarge ? (
            <span className="field-error">A imagem passa de 10 MB. Escolha um arquivo menor.</span>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="btn btn-secondary" disabled={!file || upload.pending}>
              <Icon name="upload" /> {upload.pending ? 'Enviando…' : 'Enviar imagem'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
