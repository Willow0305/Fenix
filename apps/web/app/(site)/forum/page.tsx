'use client';

import Link from 'next/link';

import { Alert, Empty, Loading } from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import type { ForumCategory, NewsSummary } from '../../../lib/content-types';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

const VISIBILITY_BADGE: Record<string, string> = {
  MEMBERS: 'Membros',
  STAFF: 'Diretoria'
};

export default function ForumPage() {
  const { status } = useAuth();
  // Espera a sessão ser resolvida: categorias restritas dependem de quem lê.
  const categories = useResource<ForumCategory[]>(
    status === 'loading' ? null : '/forum/categories'
  );
  const notices = useResource<Page<NewsSummary>>('/public/news', {
    channel: 'forum',
    pageSize: 5
  });

  return (
    <div className="container stack" style={{ paddingTop: '2.5rem' }}>
      <h1>Fórum</h1>
      <p className="muted">
        Espaço da comunidade Fênix. Leia as regras de convivência nos{' '}
        <Link href="/termos">termos de uso</Link>; conteúdo inadequado pode ser denunciado e é
        moderado pela diretoria.
        {status === 'anonymous' ? (
          <>
            {' '}
            <Link href="/entrar?next=/forum">Entre</Link> para participar.
          </>
        ) : null}
      </p>

      {notices.data && notices.data.data.length > 0 ? (
        <section className="card stack" aria-labelledby="comunicados">
          <h2 id="comunicados" style={{ margin: 0 }}>
            Comunicados
          </h2>
          <ul style={{ margin: 0 }}>
            {notices.data.data.map((news) => (
              <li key={news.id}>
                <Link href={`/noticias/${news.slug}`}>{news.title}</Link>{' '}
                <small className="muted">{formatDateTime(news.publishedAt)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {categories.error ? <Alert kind="error">{categories.error}</Alert> : null}
      {categories.loading && !categories.data ? <Loading /> : null}
      {categories.data?.length === 0 ? <Empty>Nenhuma categoria disponível.</Empty> : null}
      {categories.data?.map((category) => (
        <article key={category.id} className="card stack">
          <div className="row">
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
              <Link href={`/forum/${category.slug}`}>{category.name}</Link>
            </h2>
            {VISIBILITY_BADGE[category.visibility] ? (
              <span className="badge badge-info">{VISIBILITY_BADGE[category.visibility]}</span>
            ) : null}
            <span className="spacer" />
            <span className="muted">{category.topicCount} tópico(s)</span>
          </div>
          {category.description ? <p style={{ margin: 0 }}>{category.description}</p> : null}
        </article>
      ))}
    </div>
  );
}
