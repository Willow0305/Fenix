'use client';

import { Alert } from './ui';

/**
 * Aviso de que o registro em edição mudou em outro lugar (DT-116). O que a pessoa digitou
 * continua no formulário; ela decide se descarta e vê a versão atual.
 */
export function StaleNotice({
  stale,
  onDiscard
}: {
  readonly stale: boolean;
  readonly onDiscard: () => void;
}) {
  if (!stale) {
    return null;
  }

  return (
    <Alert kind="warning">
      Estes dados foram alterados em outro lugar enquanto você editava. O que você digitou continua
      aqui; ao salvar, vale a sua versão.{' '}
      <button type="button" className="btn btn-link" onClick={onDiscard}>
        Descartar minhas alterações e ver a versão atual
      </button>
    </Alert>
  );
}
