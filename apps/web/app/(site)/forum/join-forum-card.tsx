import Link from 'next/link';

import { Icon } from '../../../components/icon';

/** Selo público de quem tem o papel "Diretoria" (D7, DT-081). */
export function BoardBadge() {
  return (
    <span className="badge badge-brand forum-board-badge">
      <Icon name="patch-check-fill" /> Diretoria
    </span>
  );
}

/** Conta de menor acompanha o fórum, mas não publica (DT-092, ECA Digital). */
export function MinorForumNotice() {
  return (
    <p className="alert alert-info m-0">
      Contas de menores de idade acompanham o fórum, mas não publicam, respondem nem reagem. Isso
      muda sozinho quando você completar 18 anos.
    </p>
  );
}

/** Convite para entrar e participar, no lugar de uma frase solta (Onda 4). */
export function JoinForumCard({ next }: { readonly next: string }) {
  const encoded = encodeURIComponent(next);

  return (
    <aside className="card join-forum" aria-labelledby="participar">
      <div className="stack gap-sm">
        <h2 id="participar" className="list-title">
          Participe da conversa
        </h2>
        <p className="m-0">
          Com uma conta grátis você abre tópicos, responde, reage às mensagens e é avisado quando
          alguém responde ao seu tópico.
        </p>
      </div>
      <div className="row">
        <Link href={`/entrar?next=${encoded}`} className="btn btn-primary">
          Entrar
        </Link>
        <Link href="/cadastro" className="btn btn-secondary">
          Criar conta
        </Link>
      </div>
    </aside>
  );
}
