'use client';

import { useState } from 'react';

import { Icon } from './icon';

/**
 * Compartilhar notícia ou evento (D4, DT-081): WhatsApp e copiar link. Nada é coletado; o
 * link sai do próprio navegador da pessoa.
 */
export function ShareButtons({ title, url }: { readonly title: string; readonly url: string }) {
  const [status, setStatus] = useState('');
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado.');
    } catch {
      setStatus('Não deu para copiar. Selecione o endereço na barra do navegador.');
    }
  }

  return (
    <div className="share-buttons">
      <span className="muted">Compartilhar</span>
      <a
        className="btn btn-secondary btn-sm"
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="whatsapp" /> WhatsApp{' '}
        <span className="visually-hidden">(abre em nova aba)</span>
      </a>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>
        <Icon name="link-45deg" /> Copiar link
      </button>
      <span role="status" className="muted">
        {status}
      </span>
    </div>
  );
}
