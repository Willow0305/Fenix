'use client';

import { useEffect, useState } from 'react';

import { apiBlob } from '../lib/api-client';
import { initials } from '../lib/initials';

/**
 * Foto de perfil redonda com iniciais como reserva (DT-044). `authenticated` carrega a
 * imagem pelo cliente com login, porque a foto privada não abre por `<img>` comum; use no
 * painel e em Minha conta. No site público, a foto já é pública e carrega direto.
 */
export function Avatar({
  src,
  name,
  size = 40,
  authenticated = false
}: {
  readonly src: string | null | undefined;
  readonly name: string;
  readonly size?: number;
  readonly authenticated?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(authenticated ? null : (src ?? null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);

    if (!authenticated || !src) {
      setUrl(src ?? null);

      return undefined;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    apiBlob(src.replace(/^\/api\/v1/, ''))
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, authenticated]);

  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {url && !failed ? (
        <img src={url} alt={`Foto de ${name}`} onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={`Foto de ${name}`} style={{ fontSize: size * 0.4 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
