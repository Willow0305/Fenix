'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Icon } from '../components/icon';

/** Erro inesperado em uma página: mensagem em pt-BR e opção de tentar de novo. */
export default function PageError({
  error,
  reset
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // O detalhe técnico fica só no console; a tela não expõe a mensagem interna.
    console.error(error);
  }, [error]);

  return (
    <main id="conteudo" className="container stack status-page">
      <h1>Algo deu errado</h1>
      <p className="muted">
        Não foi possível carregar esta página. Tente de novo; se continuar, avise a diretoria.
        {error.digest ? ` Código para suporte: ${error.digest}.` : ''}
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          <Icon name="arrow-clockwise" /> Tentar de novo
        </button>
        <Link href="/" className="btn btn-secondary">
          <Icon name="house" /> Ir para o início
        </Link>
      </div>
    </main>
  );
}
