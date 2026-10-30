'use client';

import Link from 'next/link';

import { Alert, Empty, Loading } from '../../../components/ui';
import type { Page } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import type { ForumCategory, NewsSummary } from '../../../lib/content-types';
import { plural } from '../../../lib/format';
import { NewsTime } from '../../../components/news-card';
import { JoinForumCard } from './join-forum-card';
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
      <header className="stack gap-sm">
        <h1 className="m-0">Fórum</h1>
        <p className="muted m-0">
          A conversa da torcida, das famílias e do time. Combinados de convivência nos{' '}
          <Link href="/termos">termos de uso</Link>; a diretoria modera e responde com o selo
          "Diretoria".
        </p>
      </header>
      {status === 'anonymous' ? <JoinForumCard next="/forum" /> : null}

      {notices.data && notices.data.data.length > 0 ? (
        <section className="card stack" aria-labelledby="comunicados">
          <h2 id="comunicados" className="list-title">
            Comunicados da diretoria
          </h2>
          <ul className="list-plain stack gap-sm">
            {notices.data.data.map((news) => (
              <li key={news.id}>
                <Link href={`/noticias/${news.slug}`}>{news.title}</Link>{' '}
                <small className="muted">
                  <NewsTime iso={news.publishedAt} />
                </small>
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
            <h2 className="list-title">
              <Link href={`/forum/${category.slug}`}>{category.name}</Link>
            </h2>
            {VISIBILITY_BADGE[category.visibility] ? (
              <span className="badge badge-info">{VISIBILITY_BADGE[category.visibility]}</span>
            ) : null}
            <span className="spacer" />
            <span className="muted">{plural(category.topicCount, 'tópico', 'tópicos')}</span>
          </div>
          {category.description ? <p className="m-0">{category.description}</p> : null}
          {category.lastTopic ? (
            <p className="muted m-0">
              Última conversa:{' '}
              <Link href={`/forum/topicos/${category.lastTopic.id}`}>
                {category.lastTopic.title}
              </Link>{' '}
              · <NewsTime iso={category.lastTopic.lastActivityAt} />
            </p>
          ) : (
            <p className="muted m-0">Nenhuma conversa ainda. Que tal começar?</p>
          )}
        </article>
      ))}
    </div>
  );
}
