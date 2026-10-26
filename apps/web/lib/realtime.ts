'use client';

/**
 * Tempo real no navegador (DT-049). Lê o fluxo `/api/v1/me/events` com `fetch` (o token
 * vai no cabeçalho, nunca na URL) e avisa as telas para buscarem de novo. Os eventos não
 * trazem dados. Reconecta sozinho, com espera crescente; depois de uma queda longa, pede
 * uma ressincronização para cobrir o que possa ter mudado nesse meio-tempo.
 */
export type RealtimeMessage =
  | { readonly type: 'notification' }
  | { readonly type: 'changed'; readonly origin?: string }
  | { readonly type: 'resync' };

type Listener = (message: RealtimeMessage) => void;

const listeners = new Set<Listener>();
const RETRY_MAX_MS = 30_000;
/** Queda maior que isso pode ter perdido eventos. */
const RESYNC_AFTER_MS = 5_000;

let tabId: string | null = null;
let running = false;
let controller: AbortController | null = null;
let wakeUp: (() => void) | null = null;

/** Identificador desta aba, enviado em `X-Client-Id` para ela não recarregar o que ela mesma mudou. */
export function clientId(): string {
  tabId ??= crypto.randomUUID();

  return tabId;
}

export function onRealtime(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emit(message: RealtimeMessage): void {
  listeners.forEach((listener) => listener(message));
}

/** Extrai os eventos completos do texto recebido; devolve o resto incompleto. */
export function parseEvents(buffer: string): { events: RealtimeMessage[]; rest: string } {
  const events: RealtimeMessage[] = [];
  let rest = buffer;
  let end = rest.indexOf('\n\n');

  while (end >= 0) {
    const block = rest.slice(0, end);
    const type = /^event: (.+)$/m.exec(block)?.[1];
    const data = /^data: (.+)$/m.exec(block)?.[1];

    if (type === 'notification') {
      events.push({ type });
    } else if (type === 'changed') {
      const origin = data ? (JSON.parse(data) as { origin?: unknown }).origin : undefined;

      events.push(typeof origin === 'string' ? { type, origin } : { type });
    }

    rest = rest.slice(end + 2);
    end = rest.indexOf('\n\n');
  }

  return { events, rest };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);

    wakeUp = () => {
      clearTimeout(timer);
      resolve();
    };
  });
}

async function readStream(body: ReadableStream<Uint8Array>): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();

    if (done) {
      return;
    }

    const parsed = parseEvents(buffer + decoder.decode(value, { stream: true }));

    buffer = parsed.rest;
    parsed.events.forEach(emit);
  }
}

async function loop(getToken: () => string | null): Promise<void> {
  let retryMs = 1_000;
  let disconnectedAt: number | null = null;

  while (running) {
    const token = getToken();
    let connected = false;

    if (token) {
      controller = new AbortController();

      try {
        const response = await fetch('/api/v1/me/events', {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
            'X-Client-Id': clientId()
          },
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal
        });

        if (response.ok && response.body) {
          connected = true;
          retryMs = 1_000;

          if (disconnectedAt !== null && Date.now() - disconnectedAt > RESYNC_AFTER_MS) {
            emit({ type: 'resync' });
          }

          disconnectedAt = null;
          await readStream(response.body);
        }
      } catch {
        // Rede caiu ou a conexão foi encerrada; tenta de novo abaixo.
      }
    }

    if (!running) {
      return;
    }

    disconnectedAt ??= Date.now();

    if (connected) {
      // Fim normal (o servidor renova a conexão a cada 10 min): volta logo.
      await pause(500);
    } else {
      await pause(retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  }
}

/** Liga a conexão da sessão; `getToken` devolve sempre o token mais recente. */
export function startRealtime(getToken: () => string | null): void {
  if (running || typeof window === 'undefined' || typeof TextDecoder === 'undefined') {
    return;
  }

  running = true;
  void loop(getToken);
}

export function stopRealtime(): void {
  running = false;
  controller?.abort();
  wakeUp?.();
}

/** Usuário digitando num formulário: recarregar agora poderia trocar o que está na tela. */
function isEditing(): boolean {
  const element = document.activeElement;

  return (
    element instanceof HTMLElement &&
    /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) &&
    element.closest('form') !== null
  );
}

/**
 * Agenda uma recarga para daqui a pouco, juntando eventos seguidos. Se a pessoa estiver
 * editando, espera ela sair do campo. Devolve a função que cancela.
 */
export function scheduleReload(reload: () => void, delayMs = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  const onFocusOut = () => {
    timer = setTimeout(run, 300);
  };

  function run() {
    if (cancelled) {
      return;
    }

    if (isEditing()) {
      document.addEventListener('focusout', onFocusOut, { once: true });

      return;
    }

    reload();
  }

  timer = setTimeout(run, delayMs);

  return () => {
    cancelled = true;
    document.removeEventListener('focusout', onFocusOut);

    if (timer) {
      clearTimeout(timer);
    }
  };
}

/** Recursos da própria pessoa (`/me`, `/me/...`) mudam com as notificações dela. */
export function isOwnResource(path: string): boolean {
  return /^\/me(\/|\?|$)/.test(path);
}

/** Decide se uma tela que mostra `path` deve buscar de novo ao receber `message`. */
export function shouldReload(path: string, message: RealtimeMessage): boolean {
  if (message.type === 'resync') {
    return true;
  }

  if (message.type === 'notification') {
    return isOwnResource(path);
  }

  return !isOwnResource(path) && message.origin !== clientId();
}

/** Avisa as telas da própria pessoa de uma mudança feita aqui (ex.: marcar como lida). */
export function refreshOwnResources(): void {
  emit({ type: 'notification' });
}
