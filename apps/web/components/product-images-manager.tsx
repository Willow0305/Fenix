'use client';

import { useEffect, useId, useState } from 'react';

import { api, ApiError, errorMessage } from '../lib/api-client';
import type { ProductDetail } from '../lib/store-types';
import { Icon } from './icon';
import { Alert, ConfirmDialog } from './ui';

type Image = ProductDetail['images'][number];

const MAX_IMAGES = 12;
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
 * Fotos do produto no painel (DT-051): envio de várias de uma vez, ordem por arrastar ou
 * pelos botões (no celular), capa, descrição de cada foto e remoção. A primeira foto é a
 * capa na vitrine, no carrinho e no compartilhamento.
 */
export function ProductImagesManager({
  productId,
  images,
  onChange
}: {
  readonly productId: string;
  readonly images: readonly Image[];
  readonly onChange: (detail: ProductDetail) => void;
}) {
  const inputId = useId();
  const [order, setOrder] = useState<Image[]>([...images]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [removing, setRemoving] = useState<Image | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOrder([...images]), [images]);

  async function call(action: () => Promise<ProductDetail>, success?: string) {
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

  function saveOrder(next: Image[]) {
    setOrder(next);
    void call(
      () =>
        api<ProductDetail>(`/store/products/${productId}/images/order`, {
          method: 'PUT',
          body: { imageIds: next.map((image) => image.id) }
        }),
      'Ordem das fotos salva.'
    );
  }

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])];
    const room = MAX_IMAGES - order.length;
    const invalid = list.filter((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES);
    const valid = list.filter((file) => !invalid.includes(file)).slice(0, Math.max(0, room));
    const skipped = list.length - invalid.length - valid.length;

    setMessage(null);

    if (valid.length === 0) {
      setMessage({
        kind: 'error',
        text:
          room <= 0
            ? `O limite é de ${MAX_IMAGES} fotos por produto. Remova uma para enviar outra.`
            : 'Envie imagens PNG, JPG ou WebP de até 10 MB.'
      });

      return;
    }

    setBusy(true);

    let last: ProductDetail | null = null;
    let failed = 0;

    for (const [position, file] of valid.entries()) {
      setProgress(`Enviando ${position + 1} de ${valid.length}…`);

      const body = new FormData();

      body.set('file', file);

      try {
        last = await api<ProductDetail>(`/store/products/${productId}/images`, {
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
      `${valid.length - failed} foto(s) enviada(s).`,
      invalid.length > 0 ? `${invalid.length} ignorada(s): formato ou tamanho inválido.` : '',
      skipped > 0 ? `${skipped} ficou(aram) de fora pelo limite de ${MAX_IMAGES}.` : '',
      failed > 0 ? `${failed} não pôde(puderam) ser enviada(s).` : ''
    ].filter(Boolean);

    setMessage({ kind: failed > 0 ? 'error' : 'success', text: notes.join(' ') });
  }

  return (
    <section className="card stack" aria-labelledby="imagens">
      <h2 id="imagens">
        <Icon name="images" className="icon-lead" /> Fotos ({order.length} de {MAX_IMAGES})
      </h2>
      <p className="muted m-0">
        A primeira foto é a capa. Arraste para mudar a ordem ou use as setas. A descrição ajuda quem
        usa leitor de tela e aparece na busca.
      </p>
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
                {index === 0 ? <span className="badge badge-brand">Capa</span> : null}
              </div>
              <label className="visually-hidden" htmlFor={`${inputId}-alt-${image.id}`}>
                Descrição da foto {index + 1}
              </label>
              <input
                id={`${inputId}-alt-${image.id}`}
                type="text"
                maxLength={180}
                placeholder="Ex.: camisa vermelha, frente"
                defaultValue={image.altText ?? ''}
                disabled={busy}
                onBlur={(event) => {
                  const value = event.target.value.trim();

                  if (value !== (image.altText ?? '')) {
                    void call(
                      () =>
                        api<ProductDetail>(`/store/products/${productId}/images/${image.id}`, {
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
                {index > 0 ? (
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
        <p className="muted m-0">Nenhuma foto ainda. Produtos com foto vendem mais.</p>
      )}

      {order.length < MAX_IMAGES ? (
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
        description="A foto sai da loja. Pedidos antigos não são afetados."
        confirmLabel="Remover"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const target = removing;

          setRemoving(null);

          if (target) {
            await call(
              () =>
                api<ProductDetail>(`/store/products/${productId}/images/${target.id}`, {
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
