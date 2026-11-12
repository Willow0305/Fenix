import type { RealtimeTopic } from '@fenix/validation';

/** Leitura do fluxo de eventos (SSE) nos testes de tempo real, como faz o navegador. */
export interface StreamEvent {
  readonly type: string;
  readonly topics: readonly string[];
}

export interface Stream {
  readonly events: StreamEvent[];
  readonly status: number;
  readonly contentType: string | null;
  readonly waitFor: (match: (event: StreamEvent) => boolean, label: string) => Promise<void>;
  readonly close: () => void;
}

/** Abre o fluxo de eventos como o navegador: fetch com o token no cabeçalho. */
export async function openStream(url: string, token?: string): Promise<Stream> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal
  });
  const events: StreamEvent[] = [];
  const waiters: (() => void)[] = [];

  if (response.body) {
    void (async () => {
      const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      try {
        for (;;) {
          const { value, done } = await reader.read();

          if (done) {
            return;
          }

          buffer += value;

          let end = buffer.indexOf('\n\n');

          while (end >= 0) {
            const block = buffer.slice(0, end);
            const type = /^event: (.+)$/m.exec(block)?.[1];
            const data = /^data: (.+)$/m.exec(block)?.[1];

            if (type) {
              const topics = (JSON.parse(data ?? '{}') as { topics?: string[] }).topics ?? [];

              events.push({ type, topics });
              waiters.splice(0).forEach((wake) => wake());
            }

            buffer = buffer.slice(end + 2);
            end = buffer.indexOf('\n\n');
          }
        }
      } catch {
        // Conexão encerrada pelo teste.
      }
    })();
  }

  const waitFor = async (match: (event: StreamEvent) => boolean, label: string) => {
    const deadline = Date.now() + 5_000;

    while (!events.some(match)) {
      if (Date.now() > deadline) {
        throw new Error(`Evento ${label} não chegou (recebidos: ${JSON.stringify(events)}).`);
      }

      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 200);
      });
    }
  };

  return {
    events,
    status: response.status,
    contentType: response.headers.get('content-type'),
    waitFor,
    close: () => controller.abort()
  };
}

export const changed = (topic: RealtimeTopic) => (event: StreamEvent) =>
  event.type === 'changed' && event.topics.includes(topic);
export const receivedTopics = (stream: Stream) =>
  new Set(stream.events.filter((event) => event.type === 'changed').flatMap((e) => e.topics));
export const settle = () => new Promise((resolve) => setTimeout(resolve, 500));
