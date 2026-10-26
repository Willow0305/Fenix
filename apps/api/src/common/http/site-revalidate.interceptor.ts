import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  type OnApplicationShutdown
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { AppConfig } from '../config/app-config';
import { type PublicTopic, RealtimeService } from '../realtime/realtime.service';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/**
 * Rotas que nunca mudam conteúdo público: login, sessão, conta própria e carrinho (que só
 * reserva estoque no fechamento do pedido).
 */
const IGNORED = /^\/api\/v1\/(auth|me|cart)\b/;
const DEBOUNCE_MS = 1_000;

/** Assuntos públicos afetados por uma escrita: loja (estoque, preço) e seletivas (vagas). */
export function publicTopicsOf(path: string): PublicTopic[] {
  const topics: PublicTopic[] = [];

  if (/^\/api\/v1\/(store|orders|campaigns|public\/orders)(\/|$)/.test(path)) {
    topics.push('store');
  }

  if (/^\/api\/v1\/(tryouts|tryout-registrations|public\/tryouts)(\/|$)/.test(path)) {
    topics.push('tryouts');
  }

  return topics;
}

/**
 * Descarta o cache das páginas públicas do site (docs/29 COR-009, DT-041) e, em seguida,
 * avisa os visitantes conectados para recarregar (DT-051). Agrupa alterações em sequência
 * num único aviso; falhas viram aviso no log, nunca erro na resposta.
 */
@Injectable()
export class SiteRevalidateService implements OnApplicationShutdown {
  private readonly logger = new Logger('SiteRevalidate');
  private timer: NodeJS.Timeout | null = null;
  private readonly pending = new Set<PublicTopic>();

  constructor(
    private readonly config: AppConfig,
    private readonly realtime: RealtimeService
  ) {}

  /** Algo público mudou; `topics` diz quais páginas abertas devem recarregar. */
  changed(topics: readonly PublicTopic[] = []): void {
    topics.forEach((topic) => this.pending.add(topic));

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, DEBOUNCE_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private async flush(): Promise<void> {
    const topics = [...this.pending];

    this.pending.clear();
    await this.revalidate();
    await this.realtime.publish(
      topics.map((topic) => ({ topic })),
      { type: 'catalog' }
    );
  }

  private async revalidate(): Promise<void> {
    const target = this.config.values.siteRevalidate;

    if (target === null) {
      return;
    }

    try {
      const response = await fetch(target.url, {
        method: 'POST',
        headers: { 'x-revalidate-secret': target.secret },
        signal: AbortSignal.timeout(3_000)
      });

      if (!response.ok) {
        this.logger.warn(`O site recusou a atualização do cache (HTTP ${response.status}).`);
      }
    } catch {
      this.logger.warn('Não foi possível avisar o site para atualizar o cache.');
    }
  }
}

/** Depois de qualquer alteração bem-sucedida, pede o descarte do cache público. */
@Injectable()
export class SiteRevalidateInterceptor implements NestInterceptor {
  constructor(private readonly site: SiteRevalidateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!MUTATIONS.has(request.method) || IGNORED.test(request.path)) {
      return next.handle();
    }

    const topics = publicTopicsOf(request.path);

    return next.handle().pipe(tap({ next: () => this.site.changed(topics) }));
  }
}
