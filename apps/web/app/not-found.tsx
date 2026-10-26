import Link from 'next/link';

import { BrandLogo } from '../components/brand-logo';
import { Icon } from '../components/icon';

/** Página não encontrada (404), em pt-BR. */
export default function NotFound() {
  return (
    <main id="conteudo" className="container stack status-page">
      <BrandLogo size={96} />
      <h1>Página não encontrada</h1>
      <p className="muted">O endereço pode ter mudado ou o conteúdo foi retirado do ar.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">
          <Icon name="house" /> Ir para o início
        </Link>
        <Link href="/contato" className="btn btn-secondary">
          <Icon name="chat-dots" /> Falar com o time
        </Link>
      </div>
    </main>
  );
}
