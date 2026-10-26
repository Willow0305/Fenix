import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sem conexão', robots: { index: false } };

/** Mostrada pelo app instalado quando não há internet (DT-059). Sem dados de conta. */
export default function OfflinePage() {
  return (
    <main className="status-page">
      <img src="/brand/logo-fenix.png" alt="" width={96} height={96} />
      <h1>Você está sem internet</h1>
      <p>Confira a conexão e tente de novo. Nada do que você estava fazendo foi enviado.</p>
      <a className="btn btn-primary" href="/">
        Tentar de novo
      </a>
    </main>
  );
}
