import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import type { RequestMeta } from '../../../common/http/request-context';
import { JobScheduler, jobErrorLabel } from '../../../common/jobs/job-scheduler';
import { MailSender } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_SECONDS,
  lockMessage,
  lockSecondsAfter,
  remainingLockSeconds
} from '../domain/login-guard-rules';

const CLEANUP_INTERVAL_MS = 60 * 60_000;

/** Conta encontrada pelo e-mail digitado, para avisar o titular no bloqueio. */
export interface LoginGuardAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Hash do e-mail já normalizado; prefixo próprio para não coincidir com outros hashes. */
const keyHashOf = (normalizedEmail: string) => sha256Hex(`login-guard:${normalizedEmail}`);

/**
 * Freio de tentativas de login por conta (PEN-053, DT-109); a regra está em
 * `login-guard-rules.ts`. A contagem é atômica no PostgreSQL, compartilhada entre
 * servidores, e vale igual para e-mail com ou sem cadastro.
 */
@Injectable()
export class LoginGuardService implements OnModuleInit {
  private readonly logger = new Logger('FreioDeLogin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly mail: MailSender,
    private readonly jobs: JobScheduler
  ) {}

  onModuleInit(): void {
    this.jobs.every('login-guard.cleanup', CLEANUP_INTERVAL_MS, () => this.cleanup());
  }

  /** Recusa a tentativa enquanto o e-mail estiver bloqueado, antes de conferir a senha. */
  async assertNotLocked(normalizedEmail: string, now = new Date()): Promise<void> {
    const counter = await this.prisma.loginFailureCounter.findUnique({
      where: { keyHash: keyHashOf(normalizedEmail) },
      select: { lockedUntil: true }
    });
    const remaining = remainingLockSeconds(counter?.lockedUntil ?? null, now);

    if (remaining > 0) {
      throw new AppError('TOO_MANY_REQUESTS', 'LOGIN_TEMPORARILY_LOCKED', lockMessage(remaining));
    }
  }

  /**
   * Soma uma falha e, a partir do limite, bloqueia. Na primeira vez que a sequência chega
   * ao limite, avisa o titular por e-mail, se a conta existir.
   */
  async recordFailure(
    normalizedEmail: string,
    account: LoginGuardAccount | null,
    meta: RequestMeta,
    now = new Date()
  ): Promise<void> {
    const keyHash = keyHashOf(normalizedEmail);
    const windowStart = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_SECONDS * 1000);
    // Falha antiga (fora da janela) recomeça a sequência em 1; senão soma 1.
    const rows = await this.prisma.$queryRaw<{ failures: number }[]>`
      INSERT INTO "login_failure_counters" AS c ("id", "key_hash", "failures", "last_failure_at")
      VALUES (gen_random_uuid(), ${keyHash}, 1, ${now})
      ON CONFLICT ("key_hash") DO UPDATE SET
        "failures" = CASE WHEN c."last_failure_at" <= ${windowStart} THEN 1 ELSE c."failures" + 1 END,
        "last_failure_at" = ${now}
      RETURNING "failures"`;
    const failures = rows[0]?.failures ?? 1;
    const lockSeconds = lockSecondsAfter(failures);

    if (lockSeconds === 0) {
      return;
    }

    const lockedUntil = new Date(now.getTime() + lockSeconds * 1000);

    await this.prisma.loginFailureCounter.update({
      where: { keyHash },
      data: { lockedUntil }
    });

    if (failures !== LOGIN_FAILURE_THRESHOLD || account === null) {
      return;
    }

    await this.audit.record({
      actorUserId: null,
      action: 'auth.login.locked',
      entityType: 'User',
      entityId: account.id,
      after: { failures, lockedUntil: lockedUntil.toISOString() },
      meta
    });
    await this.alertOwner(account);
  }

  /** Login certo ou senha redefinida: a sequência recomeça. */
  async clear(normalizedEmail: string): Promise<void> {
    await this.prisma.loginFailureCounter.deleteMany({
      where: { keyHash: keyHashOf(normalizedEmail) }
    });
  }

  /** Apaga sequências sem falha há 24 horas e sem bloqueio em vigor. */
  async cleanup(now = new Date()): Promise<number> {
    const windowStart = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_SECONDS * 1000);
    const result = await this.prisma.loginFailureCounter.deleteMany({
      where: {
        lastFailureAt: { lte: windowStart },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }]
      }
    });

    return result.count;
  }

  /** O aviso não pode derrubar a resposta do login: falha de envio fica só no log. */
  private async alertOwner(account: LoginGuardAccount): Promise<void> {
    const origin = this.config.values.webOrigin;

    try {
      await this.mail.send({
        to: account.email,
        subject: 'Tentativas de entrar na sua conta — Fênix Vôlei',
        text: [
          `Olá, ${account.name}.`,
          '',
          `Houve ${LOGIN_FAILURE_THRESHOLD} tentativas seguidas de entrar na sua conta com a senha errada. Por segurança, novas tentativas ficam bloqueadas por alguns minutos.`,
          '',
          'Se foi você, espere um pouco e tente de novo, ou redefina a senha:',
          `${origin}/recuperar-senha`,
          '',
          'Se não foi você, sua senha continua protegida. Recomendamos trocá-la por uma que você não use em outros sites e ativar a verificação em duas etapas em Minha conta.'
        ].join('\n')
      });
    } catch (error) {
      this.logger.warn(`Aviso de bloqueio de login não enviado: ${jobErrorLabel(error)}`);
    }
  }
}
