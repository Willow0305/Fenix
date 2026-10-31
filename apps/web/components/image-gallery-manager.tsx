'use client';

import { useEffect, useId, useState } from 'react';

import { api, ApiError, errorMessage } from '../lib/api-client';
import { plural } from '../lib/format';
import { Icon } from './icon';
import { ImageCropDialog } from './image-crop-dialog';
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
 * descrição de cada foto, recorte (ao enviar uma foto ou depois) e remoção (DT-051). Usada
 * nas fotos do produto, na galeria da notícia e nas fotos do clube (DT-081).
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
  noun = '',
  imagesOf
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
  /** Fotos dentro da resposta da API, para "Recortar" achar a foto nova. */
  readonly imagesOf: (detail: T) => readonly GalleryImage[];
}) {
  const inputId = useId();
  const [order, setOrder] = useState<GalleryImage[]>([...images]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<GalleryImage | null>(null);
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const limitText = noun ? `${max} fotos ${noun}` : `${max} fotos`;
  // Recorte de uma foto nova (antes de enviar) ou de uma já enviada (DT-081).
  const [cropping, setCropping] = useState<
    { kind: 'new'; src: string } | { kind: 'existing'; src: string; image: GalleryImage } | null
  >(null);

  useEffect(() => setOrder([...images]), [images]);

  function closeCrop() {
    setCropping((current) => {
      if (current?.kind === 'new') {
        URL.revokeObjectURL(current.src);
      }

      return null;
    });
  }

  function postFile(file: Blob, altText?: string | null): Promise<T> {
    const body = new FormData();

    body.set('file', file, 'foto.jpg');

    if (altText) {
      body.set('altText', altText);
    }

    return api<T>(basePath, { method: 'POST', body });
  }

  /** Envia o recorte: foto nova no fim; foto existente trocada na mesma posição. */
  async function saveCrop(blob: Blob) {
    const target = cropping;

    if (!target) {
      return;
    }

    if (target.kind === 'new') {
      await postFile(blob).then(onChange);
      setMessage({ kind: 'success', text: 'Foto enviada.' });
      closeCrop();

      return;
    }

    const before = new Set(order.map((image) => image.id));
    const added = await postFile(blob, target.image.altText);
    const fresh = imagesOf(added).find((image) => !before.has(image.id));

    if (!fresh) {
      onChange(added);
      closeCrop();

      return;
    }

    // A foto nova entra no lugar da antiga, e a antiga sai.
    const ids = order.flatMap((image) =>
      image.id === target.image.id ? [fresh.id, image.id] : [image.id]
    );

    await api<T>(`${basePath}/order`, { method: 'PUT', body: { imageIds: ids } });
    onChange(await api<T>(`${basePath}/${target.image.id}`, { method: 'DELETE' }));
    setMessage({ kind: 'success', text: 'Recorte salvo.' });
    closeCrop();
  }

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

    // Uma foto por vez abre o recorte antes de enviar; várias de uma vez vão direto.
    if (valid.length === 1 && invalid.length === 0 && valid[0]) {
      setCropping({ kind: 'new', src: URL.createObjectURL(valid[0]) });

      return;
    }

    if (valid.length === 0) {
      setMessage({
        kind: 'error',
        text:
          room <= 0
            ? `O limite é de ${limitText}. Remova uma para enviar outra.`
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
    <section className="card stack" aria-labelledby={headingId}>
      <h2 id={headingId}>
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
                  className="btn btn-secondary btn-sm"
                  disabled={busy || order.length >= max}
                  onClick={() => setCropping({ kind: 'existing', src: image.url, image })}
                >
                  <Icon name="crop" /> Recortar
                </button>
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
          <span className="field-hint">Uma foto por vez abre o recorte antes de enviar.</span>
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
      ) : (
        // No limite, o motivo fica visível (botão desativado não recebe foco nem dica).
        <p className="muted m-0">
          Limite de {limitText} atingido. Para enviar ou recortar, remova uma foto antes.
        </p>
      )}

      <ImageCropDialog
        src={cropping?.src ?? null}
        title={cropping?.kind === 'existing' ? 'Recortar foto' : 'Ajustar a foto antes de enviar'}
        onCancel={closeCrop}
        onConfirm={saveCrop}
      />

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
