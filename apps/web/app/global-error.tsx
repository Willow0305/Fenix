'use client';

/** Erro no próprio layout (último recurso): página mínima em pt-BR, sem depender do CSS. */
export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '3rem 1rem' }}
      >
        <h1>Algo deu errado</h1>
        <p>Não foi possível carregar o site. Tente de novo em instantes.</p>
        <button
          type="button"
          onClick={reset}
          style={{ padding: '0.6rem 1.2rem', fontSize: '1rem' }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
