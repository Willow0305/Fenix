'use client';

import Link from 'next/link';

import { Alert, Empty, Loading, PageHeader } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useResource } from '../../../../lib/use-resource';

interface Favorite {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
}

export default function FavoritesPage() {
  const favorites = useResource<Favorite[]>('/me/favorites');

  async function remove(productId: string) {
    await api(`/me/favorites/${productId}`, { method: 'DELETE' });
    await favorites.reload();
  }

  return (
    <>
      <PageHeader title="Favoritos" description="Produtos que você salvou na loja." />
      {favorites.error ? <Alert kind="error">{favorites.error}</Alert> : null}
      {favorites.loading && !favorites.data ? <Loading /> : null}
      {favorites.data?.length === 0 ? (
        <Empty>
          Nenhum favorito. <Link href="/loja">Explore a loja</Link>
        </Empty>
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
        }}
      >
        {favorites.data?.map((favorite) => (
          <div key={favorite.productId} className="card stack">
            {favorite.image ? (
              <img
                src={favorite.image}
                alt={favorite.name}
                style={{ aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }}
              />
            ) : null}
            <Link href={`/loja/${favorite.slug}`}>{favorite.name}</Link>
            <button
              type="button"
              className="btn btn-link"
              onClick={() => void remove(favorite.productId)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
