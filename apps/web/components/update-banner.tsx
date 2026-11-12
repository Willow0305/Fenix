'use client';

import { Icon } from './icon';

/**
 * "Há novidades" (DT-116): em páginas de leitura (fórum, notícias), o conteúdo novo não entra
 * sozinho, para o texto não pular enquanto a pessoa lê. Ela decide quando atualizar.
 */
export function UpdateBanner({
  visible,
  onApply,
  label = 'Há novidades nesta página.'
}: {
  readonly visible: boolean;
  readonly onApply: () => void;
  readonly label?: string;
}) {
  return (
    <div className="update-banner-region" role="status">
      {visible ? (
        <p className="update-banner">
          <Icon name="arrow-clockwise" />
          <span>{label}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
            Atualizar
          </button>
        </p>
      ) : null}
    </div>
  );
}
