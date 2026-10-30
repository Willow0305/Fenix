'use client';

import { useEffect, useId, useState } from 'react';

import { api, ApiError, errorMessage } from '../lib/api-client';
import { plural } from '../lib/format';
import { Icon } from './icon';
import { Alert, ConfirmDialog } from './ui';

export interface GalleryImage {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/** Move o item de `from` para `to`, sem mudar o restante. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);

  if (item === undefined) {
    return next;
  }

  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);

  return next;
}

/**
 * Fotos com envio de várias de uma vez, ordem por arrastar ou pelos botões (no celular),
 * descrição de cada foto e remoção (DT-051). Usada nas fotos do produto e na galeria da
 * notícia (D8, DT-081).
 */
export function ImageGalleryManager<T>({
  basePath,
  images,
  onChange,
  max,
  title = 'Fotos',
  intro,
  emptyText,
  placeholder,
  removeDescription,
  firstIsCover = false,
  noun = 'foto'
}: {
  /** Base REST: POST (envio), PUT `order`, PATCH e DELETE `/:imageId`. */
  readonly basePath: string;
  readonly images: readonly GalleryImage[];
  readonly onChange: (detail: T) => void;
  readonly max: number;
  readonly title?: string;
  readonly intro: string;
  readonly emptyText: string;
  readonly placeholder: string;
  readonly removeDescription: string;
  /** A primeira foto é a capa (loja); na galeria da notícia, não. */
  readonly firstIsCover?: boolean;
  /** Para a mensagem de limite: "por produto", "por notícia". */
  readonly noun?: string;
}) {
  const inputId = useId();
  const [order, setOrder] = useState<GalleryImage[]>([...images]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<GalleryImage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOrder([...images]), [images]);

  async function call(action: () => Promise<T>, success?: string) {
    setBusy(true);
    setMessage(null);

    try {
      onChange(await action());

      if (success) {
        setMessage({ kind: 'success', text: success });
      }
    } catch (error) {
      setOrder([...images]);
      setMessage({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function saveOrder(next: GalleryImage[]) {
    setOrder(next);
    void call(
      () =>
        api<T>(`${basePath}/order`, {
          method: 'PUT',
          body: { imageIds: next.map((image) => image.id) }
        }),
      'Ordem das fotos salva.'
    );
  }

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    const room = max - order.length;
    const invalid = list.filter((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES);
    const valid = list.filter((file) => !invalid.includes(file)).slice(0, Math.max(0, room));
    const skipped = list.length - invalid.length - valid.length;

    setMessage(null);

    if (valid.length === 0) {
      setMessage({
        kind: 'error',
        text:
          room <= 0
            ? `O limite é de ${max} fotos ${noun}. Remova uma para enviar outra.`
            : 'Envie imagens PNG, JPG ou WebP de até 10 MB.'
      });

      return;
    }

    setBusy(true);

    let last: T | null = null;
    let failed = 0;

    for (const [position, file] of valid.entries()) {
      setProgress(`Enviando ${position + 1} de ${valid.length}…`);

      const body = new FormData();

      body.set('file', file);

      try {
        last = await api<T>(basePath, {
          method: 'POST',
          body
        });
      } catch (error) {
        failed += 1;

        if (error instanceof ApiError && error.problem.code === 'TOO_MANY_IMAGES') {
          break;
        }
      }
    }

    setProgress(null);
    setBusy(false);

    if (last) {
      onChange(last);
    }

    const notes = [
      `${plural(valid.length - failed, 'foto enviada', 'fotos enviadas')}.`,
      invalid.length > 0
        ? `${plural(invalid.length, 'ignorada', 'ignoradas')}: formato ou tamanho inválido.`
        : '',
      skipped > 0 ? `Fora do limite de ${max} fotos: ${skipped}.` : '',
      failed > 0
        ? failed === 1
          ? '1 foto não pôde ser enviada.'
          : `${failed} fotos não puderam ser enviadas.`
        : ''
    ].filter(Boolean);

    setMessage({ kind: failed > 0 ? 'error' : 'success', text: notes.join(' ') });
  }

  return (
    <section className="card stack" aria-labelledby="imagens">
      <h2 id="imagens">
        <Icon name="images" className="icon-lead" /> {title} ({order.length} de {max})
      </h2>
      <p className="muted m-0">{intro}</p>
      {message ? <Alert kind={message.kind}>{message.text}</Alert> : null}
      {progress ? (
        <p role="status" className="muted m-0">
          {progress}
        </p>
      ) : null}

      {order.length > 0 ? (
        <ol className="image-manager">
          {order.map((image, index) => (
            <li
              key={image.id}
              className={`image-tile${dragging === index ? ' is-dragging' : ''}`}
              draggable={!busy}
              onDragStart={(event) => {
                setDragging(index);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (dragging !== null) {
                  event.preventDefault();
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (dragging !== null && dragging !== index) {
                  saveOrder(moveItem(order, dragging, index));
                }

                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
            >
              <div className="image-tile-photo">
                <img src={image.url} alt={image.altText ?? ''} loading="lazy" />
                {firstIsCover && index === 0 ? (
                  <span className="badge badge-brand">Capa</span>
                ) : null}
              </div>
              <label className="visually-hidden" htmlFor={`${inputId}-alt-${image.id}`}>
                Descrição da foto {index + 1}
              </label>
              <input
                id={`${inputId}-alt-${image.id}`}
                type="text"
                maxLength={180}
                placeholder={placeholder}
                defaultValue={image.altText ?? ''}
                disabled={busy}
                onBlur={(event) => {
                  const value = event.target.value.trim();

                  if (value !== (image.altText ?? '')) {
                    void call(
                      () =>
                        api<T>(`${basePath}/${image.id}`, {
                          method: 'PATCH',
                          body: { altText: value }
                        }),
                      'Descrição salva.'
                    );
                  }
                }}
              />
              <div className="image-tile-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-label={`Mover foto ${index + 1} para a esquerda`}
                  disabled={busy || index === 0}
                  onClick={() => saveOrder(moveItem(order, index, index - 1))}
                >
                  <Icon name="arrow-left" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  aria-label={`Mover foto ${index + 1} para a direita`}
                  disabled={busy || index === order.length - 1}
                  onClick={() => saveOrder(moveItem(order, index, index + 1))}
                >
                  <Icon name="arrow-right" />
                </button>
                {firstIsCover && index > 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => saveOrder(moveItem(order, index, 0))}
                  >
                    Tornar capa
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-link"
                  aria-label={`Remover foto ${index + 1}`}
                  disabled={busy}
                  onClick={() => setRemoving(image)}
                >
                  <Icon name="trash3" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted m-0">{emptyText}</p>
      )}

      {order.length < max ? (
        <div className="field">
          <label htmlFor={inputId}>Adicionar fotos (PNG, JPG ou WebP, até 10 MB cada)</label>
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            disabled={busy}
            onChange={(event) => {
              void upload(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Remover foto"
        description={removeDescription}
        confirmLabel="Remover"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing;

          setRemoving(null);

          if (target) {
            await call(
              () =>
                api<T>(`${basePath}/${target.id}`, {
                  method: 'DELETE'
                }),
              'Foto removida.'
            );
          }
        }}
      />
    </section>
  );
}
