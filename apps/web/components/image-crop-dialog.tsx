'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

import { cropToBlob } from '../lib/crop-image';
import { Alert } from './ui';

/** Formatos oferecidos; "Original" mantém a proporção da foto enviada. */
const ASPECTS: readonly (readonly [string, number | null])[] = [
  ['Original', null],
  ['3:2', 3 / 2],
  ['16:9', 16 / 9],
  ['4:3', 4 / 3],
  ['1:1', 1]
];

/**
 * Janela para cortar uma foto antes de enviar (DT-081): arrastar para enquadrar, aproximar
 * pela barra (ou pinça no celular) e escolher o formato. Também funciona pelo teclado: setas
 * movem a imagem dentro do quadro.
 */
export function ImageCropDialog({
  src,
  title,
  initialAspect = null,
  onCancel,
  onConfirm
}: {
  /** Imagem a cortar; `null` fecha a janela. */
  readonly src: string | null;
  readonly title: string;
  /** Formato inicial (ex.: 3:2 na foto do time); sem ele, começa no "Original". */
  readonly initialAspect?: number | null;
  readonly onCancel: () => void;
  readonly onConfirm: (blob: Blob) => Promise<void> | void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const zoomId = useId();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | null>(null);
  const [natural, setNatural] = useState(3 / 2);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;

    if (!element) {
      return;
    }

    if (src && !element.open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(initialAspect);
      setError(null);
      element.showModal();
    } else if (!src && element.open) {
      element.close();
    }
  }, [src, initialAspect]);

  async function confirm() {
    if (!src || !area) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onConfirm(await cropToBlob(src, area));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível cortar a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="crop-dialog"
      aria-labelledby={`${zoomId}-title`}
      onClose={onCancel}
    >
      <h2 id={`${zoomId}-title`} className="m-0">
        {title}
      </h2>
      <div className="crop-stage">
        {src ? (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect ?? natural}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(media) => setNatural(media.naturalWidth / media.naturalHeight)}
            objectFit="contain"
          />
        ) : null}
      </div>
      <div className="row" role="group" aria-label="Formato do corte">
        {ASPECTS.map(([label, value]) => (
          <button
            key={label}
            type="button"
            className={`btn btn-sm ${aspect === value ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={aspect === value}
            onClick={() => setAspect(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={zoomId}>Aproximar</label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
      </div>
      <p className="muted m-0">
        Arraste a foto para enquadrar. O que fica dentro do quadro é enviado.
      </p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !area}
          onClick={() => void confirm()}
        >
          {busy ? 'Enviando…' : 'Usar recorte'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => dialog.current?.close()}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
