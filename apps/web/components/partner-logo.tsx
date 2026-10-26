'use client';

import { useEffect, useState } from 'react';
import { initials } from '../lib/initials';

/** Logo do parceiro em círculo; sem logo (ou se falhar), mostra as iniciais (docs/29 §3.6). */
export function PartnerLogo({
  src,
  name,
  size = 72
}: {
  readonly src: string | null;
  readonly name: string;
  readonly size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <span className="partner-logo" style={{ width: size, height: size }}>
      {src && !failed ? (
        <img src={src} alt={`Logo de ${name}`} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={`Logo de ${name}`} style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
