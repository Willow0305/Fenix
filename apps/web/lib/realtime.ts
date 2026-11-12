'use client';

import { isRealtimeTopic, type RealtimeTopic, topicsOfPath } from '@fenix/validation';

/**
 * Tempo real no navegador (DT-049, DT-116). Uma conexão só por navegador, dividida entre as
 * abas: a aba que segura a trava (`navigator.locks`) abre o fluxo e repassa os eventos às
 * outras por `BroadcastChannel`; quando ela fecha, outra assume. Com sessão, o fluxo é o da
 * pessoa (`/api/v1/me/events`, token no cabeçalho, nunca na URL); sem sessão, o público.
 *
 * Os eventos não trazem dados: dizem só os assuntos que mudaram, e as telas buscam de novo
 * pela API. Depois de qualquer queda, de voltar à internet ou de a aba ficar muito tempo
 * escondida, pede uma ressincronização, porque eventos podem ter se perdido no caminho.
 */
export type RealtimeMessage =
  | { readonly type: 'notification' }
  | { readonly type: 'changed'; readonly topics: readonly RealtimeTopic[] }
  | { readonly type: 'catalog'; readonly topics: readonly RealtimeTopic[] }
  | { readonly type: 'resync' };

/** `reconnecting`: a conexão caiu e ainda não voltou. */
export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'reconnecting';

type Listener = (message: RealtimeMessage) => void;

interface ChannelData {
  readonly message?: RealtimeMessage;
  readonly status?: RealtimeStatus;
  /** Aba nova pedindo à líder a situação atual da conexão. */
  readonly hello?: true;
}

const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
const RETRY_MAX_MS = 30_000;
/** O servidor manda sinal de vida a cada 25 s; sem nada por 60 s, a conexão morreu calada. */
const SILENCE_MS = 60_000;
/** Aba escondida por mais que isso pode ter perdido eventos (o navegador pausa abas). */
const HIDDEN_RESYNC_MS = 30_000;
/** Trava concedida depois disso: havia outra aba líder, e a troca pode ter perdido eventos. */
const HANDOVER_MS = 200;

interface Session {
  readonly userId: string;
  readonly getToken: () => string | null;
}

interface Connection {
  readonly key: string;
  readonly stop: () => void;
}

let session: Session | null = null;
let publicDemand = 0;
/** Já se sabe que não há sessão (evita abrir o fluxo público e trocá-lo logo pelo da pessoa). */
let anonymous = false;
let current: Connection | null = null;
let status: RealtimeStatus = 'off';
let wakeUp: (() => void) | null = null;
let hiddenAt: number | null = null;
let pageHooks = false;

export function onRealtime(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emit(message: RealtimeMessage): void {
  listeners.forEach((listener) => listener(message));
}

export function realtimeStatus(): RealtimeStatus {
  return status;
}

export function onRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);

  return () => {
    statusListeners.delete(listener);
  };
}

function setStatus(next: RealtimeStatus): void {
  if (status !== next) {
    status = next;
    statusListeners.forEach((listener) => listener());
  }
}

function topicsOf(data: string | undefined): RealtimeTopic[] {
  try {
    const parsed = data ? (JSON.parse(data) as { topics?: unknown }) : {};

    return Array.isArray(parsed.topics) ? parsed.topics.filter(isRealtimeTopic) : [];
  } catch {
    return [];
  }
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
    } else if (type === 'changed' || type === 'catalog') {
      const topics = topicsOf(data);

      if (topics.length > 0) {
        events.push({ type, topics });
      }
    }

    rest = rest.slice(end + 2);
    end = rest.indexOf('\n\n');
  }

  return { events, rest };
}

function isMessage(value: unknown): value is RealtimeMessage {
  const type = (value as { type?: unknown } | null)?.type;

  return type === 'notification' || type === 'changed' || type === 'catalog' || type === 'resync';
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      wakeUp = null;
      resolve();
    };
    const timer = setTimeout(done, ms);

    wakeUp = done;
    signal.addEventListener('abort', done, { once: true });
  });
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  publish: (message: RealtimeMessage) => void,
  abort: () => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let silence = setTimeout(abort, SILENCE_MS);

  try {
    for (;;) {
      const { value, done } = await reader.read();

      if (done) {
        return;
      }

      clearTimeout(silence);
      silence = setTimeout(abort, SILENCE_MS);

      const parsed = parseEvents(buffer + decoder.decode(value, { stream: true }));

      buffer = parsed.rest;
      parsed.events.forEach(publish);
    }
  } finally {
    clearTimeout(silence);
  }
}

/**
 * Fluxo público, sem token: usa o `EventSource` do navegador, que reconecta sozinho (DT-051).
 * Se o servidor recusar (ex.: muitas páginas abertas no mesmo IP), o navegador desiste; aí
 * tenta de novo com espera crescente. Ao voltar depois de uma queda, pede ressincronização.
 */
function leadPublic(
  signal: AbortSignal,
  publish: (message: RealtimeMessage) => void,
  announce: (next: RealtimeStatus) => void,
  resyncOnConnect: boolean
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof EventSource === 'undefined') {
      resolve();

      return;
    }

    let lostEvents = resyncOnConnect;
    let retryMs = 1_000;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const relay = (event: MessageEvent<string>) => {
      parseEvents(`event: ${event.type}\ndata: ${event.data}\n\n`).events.forEach(publish);
    };
    const open = () => {
      retry = null;
      source = new EventSource('/api/v1/public/live');
      source.addEventListener('changed', relay);
      source.addEventListener('catalog', relay);
      source.onopen = () => {
        retryMs = 1_000;
        announce('live');

        if (lostEvents) {
          publish({ type: 'resync' });
        }

        lostEvents = false;
      };
      source.onerror = () => {
        lostEvents = true;
        announce('reconnecting');

        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          retry = setTimeout(open, retryMs);
          retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
        }
      };
    };

    announce('connecting');
    open();
    signal.addEventListener(
      'abort',
      () => {
        source?.close();

        if (retry) {
          clearTimeout(retry);
        }

        resolve();
      },
      { once: true }
    );
  });
}

/**
 * Mantém o fluxo aberto enquanto esta aba for a líder. Reconecta com espera crescente; ao
 * voltar depois de uma queda, pede ressincronização a todas as abas.
 */
async function lead(
  key: string,
  signal: AbortSignal,
  publish: (message: RealtimeMessage) => void,
  announce: (next: RealtimeStatus) => void,
  resyncOnConnect: boolean
): Promise<void> {
  if (key === 'publico') {
    return leadPublic(signal, publish, announce, resyncOnConnect);
  }

  let retryMs = 1_000;
  let lostEvents = resyncOnConnect;

  announce('connecting');

  while (!signal.aborted) {
    const token = session?.getToken() ?? null;
    const request = new AbortController();
    const stopRequest = () => request.abort();
    let connected = false;

    signal.addEventListener('abort', stopRequest, { once: true });

    if (token) {
      try {
        const response = await fetch('/api/v1/me/events', {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
          cache: 'no-store',
          credentials: 'same-origin',
          signal: request.signal
        });

        if (response.ok && response.body) {
          connected = true;
          retryMs = 1_000;
          announce('live');

          if (lostEvents) {
            publish({ type: 'resync' });
          }

          await readStream(response.body, publish, stopRequest);
        }
      } catch {
        // Rede caiu, a conexão ficou calada ou foi encerrada; tenta de novo abaixo.
      }
    }

    signal.removeEventListener('abort', stopRequest);

    if (signal.aborted) {
      return;
    }

    // Do fim da conexão até a próxima, algum evento pode ter passado.
    lostEvents = true;

    if (connected) {
      // Fim normal (o servidor renova a conexão a cada 10 min): volta logo.
      await pause(500, signal);
    } else {
      announce('reconnecting');
      await pause(retryMs, signal);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  }
}

/** Entra no grupo de abas de `key`: uma delas abre a conexão, as outras escutam. */
function join(key: string): Connection {
  const name = `fenix-tempo-real:${key}`;
  const stop = new AbortController();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name);
  let leading = false;

  const publish = (message: RealtimeMessage) => {
    emit(message);
    channel?.postMessage({ message } satisfies ChannelData);
  };
  const announce = (next: RealtimeStatus) => {
    setStatus(next);
    channel?.postMessage({ status: next } satisfies ChannelData);
  };

  channel?.addEventListener('message', (event: MessageEvent<ChannelData>) => {
    const data = event.data;

    if (data.hello && leading) {
      channel.postMessage({ status } satisfies ChannelData);
    }

    if (!leading && isMessage(data.message)) {
      emit(data.message);
    }

    if (!leading && data.status) {
      setStatus(data.status);
    }
  });

  const requestedAt = Date.now();
  const run = (handover: boolean) => {
    leading = true;

    return lead(key, stop.signal, publish, announce, handover).finally(() => {
      leading = false;
    });
  };

  if (typeof navigator !== 'undefined' && 'locks' in navigator && channel) {
    setStatus('connecting');
    channel.postMessage({ hello: true } satisfies ChannelData);
    navigator.locks
      .request(name, { signal: stop.signal }, () => run(Date.now() - requestedAt > HANDOVER_MS))
      .catch(() => undefined);
  } else {
    // Navegador sem trava entre abas: cada aba com a sua conexão, como antes.
    void run(false);
  }

  return {
    key,
    stop: () => {
      stop.abort();
      channel?.close();
    }
  };
}

function desiredKey(): string | null {
  if (session) {
    return `u:${session.userId}`;
  }

  return anonymous && publicDemand > 0 ? 'publico' : null;
}

function installPageHooks(): void {
  if (pageHooks) {
    return;
  }

  pageHooks = true;
  // De volta à internet: tenta reconectar já, sem esperar a pausa crescente.
  window.addEventListener('online', () => wakeUp?.());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();

      return;
    }

    if (hiddenAt !== null && Date.now() - hiddenAt > HIDDEN_RESYNC_MS && current) {
      emit({ type: 'resync' });
    }

    hiddenAt = null;
  });
}

function reconcile(): void {
  if (typeof window === 'undefined' || typeof TextDecoder === 'undefined') {
    return;
  }

  const key = desiredKey();

  if (current?.key === key) {
    return;
  }

  current?.stop();
  current = null;

  if (key === null) {
    setStatus('off');

    return;
  }

  installPageHooks();
  current = join(key);
}

/** Liga a conexão da sessão; `getToken` devolve sempre o token mais recente. */
export function startRealtime(userId: string, getToken: () => string | null): void {
  session = { userId, getToken };
  reconcile();
}

export function stopRealtime(): void {
  session = null;
  reconcile();
}

/** A conferência do login terminou sem sessão: as páginas públicas podem ligar o fluxo. */
export function setAnonymousRealtime(value: boolean): void {
  anonymous = value;
  reconcile();
}

/**
 * Página pública que quer se atualizar sozinha: sem sessão, liga o fluxo público enquanto
 * ela estiver aberta. Com sessão, o fluxo da pessoa já traz os assuntos públicos.
 */
export function requirePublicRealtime(): () => void {
  publicDemand += 1;
  reconcile();

  let released = false;

  return () => {
    if (!released) {
      released = true;
      publicDemand -= 1;
      reconcile();
    }
  };
}

/**
 * Acompanha um pedido ao vivo sem login (pedido sem conta e entregador, DT-116), com a chave
 * assinada que veio na consulta. Conexão própria, só enquanto a tela estiver aberta: chama
 * `onChange` quando o pedido muda e ao voltar de uma queda, para a tela buscar de novo.
 */
const ORDER_TOPICS: readonly RealtimeTopic[] = ['orders', 'payments', 'delivery'];

export function watchOrder(liveKey: string, onChange: () => void): () => void {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }

  const source = new EventSource(`/api/v1/public/live?watch=${encodeURIComponent(liveKey)}`);
  let dropped = false;
  let cancel: (() => void) | null = null;
  const changed = () => {
    cancel ??= scheduleReload(() => {
      cancel = null;
      onChange();
    }, 300);
  };

  // O fluxo público também traz a loja, a agenda…; pedido, pagamento e entrega só chegam a
  // um visitante pelo pedido acompanhado.
  source.addEventListener('changed', (event: MessageEvent<string>) => {
    const order = topicsOf(event.data).some((topic) => ORDER_TOPICS.includes(topic));

    if (order) {
      changed();
    }
  });
  source.onerror = () => {
    dropped = true;
  };
  source.onopen = () => {
    if (dropped) {
      dropped = false;
      changed();
    }
  };

  return () => {
    source.close();
    cancel?.();
  };
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

  if (message.type === 'catalog') {
    // Páginas públicas em cache tratam este aviso (`LiveRefresh`); as consultas, o `changed`.
    return false;
  }

  const shown = topicsOfPath(path);

  return message.topics.some((topic) => shown.includes(topic));
}

/** Avisa as telas da própria pessoa de uma mudança feita aqui (ex.: marcar como lida). */
export function refreshOwnResources(): void {
  emit({ type: 'notification' });
}
