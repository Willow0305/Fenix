'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Politeness = 'polite' | 'assertive';
type Listener = (message: string, politeness: Politeness) => void;

/**
 * Anunciador fixo para o leitor de tela (WCAG 4.1.3). Uma região que já nasce com o texto
 * nem sempre é lida; estas duas existem desde o início da página e só trocam o texto.
 */
let listener: Listener | null = null;
/** Tempo para o leitor de tela ler a mensagem antes de a cópia escondida sair. */
const CLEAR_AFTER_MS = 5000;
/** Quando a página atual abriu e quando a pessoa clicou ou digitou pela última vez. */
let navigatedAt = 0;
let interactedAt = 0;

function markInteraction(): void {
  interactedAt = Date.now();
}

/**
 * Mensagem nova merece ser lida quando veio depois de uma ação da pessoa nesta página
 * (enviar, salvar, conferir). Avisos que já estão na página ao abrir não são anunciados:
 * quem usa leitor de tela os encontra lendo a página, como antes.
 */
export function shouldAnnounce(now = Date.now()): boolean {
  return interactedAt > 0 && interactedAt >= navigatedAt && now >= interactedAt;
}

export function announce(message: string, politeness: Politeness = 'polite'): void {
  const text = message.replace(/\s+/g, ' ').trim();

  if (text && listener) {
    listener(text, politeness);
  }
}

/** Só para os testes: zera os instantes guardados. */
export function resetAnnouncerForTests(): void {
  navigatedAt = 0;
  interactedAt = 0;
}

export function LiveAnnouncer() {
  const pathname = usePathname();
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    navigatedAt = Date.now();
  }, [pathname]);

  useEffect(() => {
    let timer: number | undefined;
    let clear: number | undefined;

    listener = (message, politeness) => {
      const set = politeness === 'assertive' ? setAssertive : setPolite;

      // Esvazia antes: a mesma mensagem duas vezes seguidas também é lida. Depois de lida,
      // a cópia escondida sai, para não ficar texto repetido na página.
      set('');
      window.clearTimeout(timer);
      window.clearTimeout(clear);
      timer = window.setTimeout(() => {
        set(message);
        clear = window.setTimeout(() => set(''), CLEAR_AFTER_MS);
      }, 60);
    };
    window.addEventListener('pointerdown', markInteraction, true);
    window.addEventListener('keydown', markInteraction, true);

    return () => {
      listener = null;
      window.clearTimeout(timer);
      window.clearTimeout(clear);
      window.removeEventListener('pointerdown', markInteraction, true);
      window.removeEventListener('keydown', markInteraction, true);
    };
  }, []);

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
