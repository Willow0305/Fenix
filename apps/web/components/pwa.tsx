'use client';

import { useEffect, useState } from 'react';

import { Icon } from './icon';

interface InstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Registra o service worker (DT-059); só em produção, para não atrapalhar o desenvolvimento. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  return null;
}

/** Botão "Instalar aplicativo", visível só quando o navegador oferece a instalação. */
export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!prompt) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={() => {
        void prompt.prompt().then(() => setPrompt(null));
      }}
    >
      <Icon name="phone" /> Instalar aplicativo
    </button>
  );
}
