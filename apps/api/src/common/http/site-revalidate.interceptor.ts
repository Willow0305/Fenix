import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { AppConfig } from '../config/app-config';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Rotas que nunca mudam conteúdo público (login, sessão, conta própria). */
const IGNORED = /^\/api\/v1\/(auth|me)\b/;
const DEBOUNCE_MS = 1_000;

/**
 * Depois de qualquer alteração bem-sucedida, avisa o site para descartar o cache das
 * páginas públicas (docs/29 COR-009, DT-041). Agrupa alterações em sequência num único
 * aviso e nunca atrasa nem derruba a resposta: falhas viram aviso no log.
 */
@Injectable()
export class SiteRevalidateInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SiteRevalidate');
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly config: AppConfig) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const relevant =
      this.config.values.siteRevalidate !== null &&
      MUTATIONS.has(request.method) &&
      !IGNORED.test(request.originalUrl);

    return relevant ? next.handle().pipe(tap({ next: () => this.schedule() })) : next.handle();
  }

  private schedule(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.notify();
    }, DEBOUNCE_MS);
    this.timer.unref();
  }

  private async notify(): Promise<void> {
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
