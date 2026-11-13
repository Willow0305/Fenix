'use client';

import { Alert } from './ui';

/**
 * Aviso de que o registro em edição mudou em outro lugar (DT-116). O que a pessoa digitou
 * continua no formulário; ela decide se descarta e vê a versão atual. Descartar pode ser
 * desfeito até ela voltar a editar.
 */
export function StaleNotice({
  stale,
  onDiscard,
  canUndo,
  onUndo
}: {
  readonly stale: boolean;
  readonly onDiscard: () => void;
  readonly canUndo: boolean;
  readonly onUndo: () => void;
}) {
  if (canUndo) {
    return (
      <Alert kind="info">
        Versão atual carregada; o que você tinha digitado foi descartado.{' '}
        <button type="button" className="btn btn-link" onClick={onUndo}>
          Desfazer
        </button>
      </Alert>
    );
  }

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
