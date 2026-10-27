import type { LoggerService } from '@nestjs/common';

type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Logs em JSON, uma linha por evento (R-07), para o coletor da hospedagem. As mensagens são
 * escritas pela própria aplicação e nunca levam dado pessoal, token ou corpo de requisição;
 * pilha de erro só entra fora de produção.
 */
export class JsonLogger implements LoggerService {
  constructor(
    private readonly write: (line: string, level: Level) => void = (line, level) =>
      (level === 'error' || level === 'fatal' ? process.stderr : process.stdout).write(`${line}\n`),
    private readonly includeStack = process.env['NODE_ENV'] !== 'production'
  ) {}

  private emit(
    level: Level,
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>
  ): void {
    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      ...(typeof message === 'object' && message !== null
        ? (message as Record<string, unknown>)
        : { msg: String(message) }),
      ...extra
    };

    this.write(JSON.stringify(entry), level);
  }

  /** Nest chama com (mensagem, ...parâmetros, contexto): o último texto é o contexto. */
  private split(params: unknown[]): { context?: string; rest: unknown[] } {
    const last = params[params.length - 1];

    return typeof last === 'string'
      ? { context: last, rest: params.slice(0, -1) }
      : { rest: params };
  }

  log(message: unknown, ...params: unknown[]): void {
    const { context } = this.split(params);

    this.emit('info', message, context);
  }

  warn(message: unknown, ...params: unknown[]): void {
    const { context } = this.split(params);

    this.emit('warn', message, context);
  }

  error(message: unknown, ...params: unknown[]): void {
    const { context, rest } = this.split(params);
    const stack = rest.find((value): value is string => typeof value === 'string');

    this.emit('error', message, context, this.includeStack && stack ? { stack } : undefined);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    const { context } = this.split(params);

    this.emit('fatal', message, context);
  }

  debug(message: unknown, ...params: unknown[]): void {
    const { context } = this.split(params);

    this.emit('debug', message, context);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    const { context } = this.split(params);

    this.emit('verbose', message, context);
  }
}

/** JSON em produção; texto colorido no desenvolvimento (`LOG_FORMAT=json|text`). */
export function useJsonLogs(env: NodeJS.ProcessEnv = process.env): boolean {
  const format = env['LOG_FORMAT'] ?? (env['NODE_ENV'] === 'production' ? 'json' : 'text');

  return format === 'json';
}
