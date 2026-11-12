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
  type LoginCounterState,
  lockMessage,
  reserveAttempt
} from '../domain/login-guard-rules';

const CLEANUP_INTERVAL_MS = 60 * 60_000;

/** Conta encontrada pelo e-mail digitado, para avisar o titular no bloqueio. */
export interface LoginGuardAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Tentativa reservada: a posição dela na sequência de falhas e o bloqueio que já deixou. */
export interface LoginAttempt {
  readonly failures: number;
  readonly lockedUntil: Date | null;
}

/** Hash do e-mail já normalizado; prefixo próprio para não coincidir com outros hashes. */
const keyHashOf = (normalizedEmail: string) => sha256Hex(`login-guard:${normalizedEmail}`);

/**
 * Freio de tentativas de login por conta (PEN-053, DT-109); a regra está em
 * `login-guard-rules.ts`. Cada tentativa é reservada antes de conferir a senha, com a linha
 * do e-mail travada no PostgreSQL: tentativas simultâneas, em qualquer servidor, esperam
 * umas pelas outras e não passam juntas do limite. Vale igual para e-mail com ou sem cadastro.
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

  /**
   * Reserva a tentativa antes de conferir a senha (ela já conta como falha; o login certo
   * zera em seguida com `clear`). Bloqueado, recusa sem conferir a senha.
   */
  async beginAttempt(normalizedEmail: string, now = new Date()): Promise<LoginAttempt> {
    const keyHash = keyHashOf(normalizedEmail);
    const decision = await this.prisma.$transaction(async (tx) => {
      // Cria a linha ou trava a que existe; quem chega ao mesmo tempo espera aqui.
      const rows = await tx.$queryRaw<
        { failures: number; last_failure_at: Date; locked_until: Date | null }[]
      >`
        INSERT INTO "login_failure_counters" AS c ("id", "key_hash", "failures", "last_failure_at")
        VALUES (gen_random_uuid(), ${keyHash}, 0, ${now})
        ON CONFLICT ("key_hash") DO UPDATE SET "key_hash" = c."key_hash"
        RETURNING "failures", "last_failure_at", "locked_until"`;
      const row = rows[0];
      const state: LoginCounterState | null =
        row === undefined || row.failures === 0
          ? null
          : {
              failures: row.failures,
              lastFailureAt: row.last_failure_at,
              lockedUntil: row.locked_until
            };
      const next = reserveAttempt(state, now);

      if (next.kind === 'ALLOWED') {
        await tx.loginFailureCounter.update({
          where: { keyHash },
          data: { failures: next.failures, lastFailureAt: now, lockedUntil: next.lockedUntil }
        });
      }

      return next;
    });

    if (decision.kind === 'LOCKED') {
      throw new AppError(
        'TOO_MANY_REQUESTS',
        'LOGIN_TEMPORARILY_LOCKED',
        lockMessage(decision.remainingSeconds)
      );
    }

    return { failures: decision.failures, lockedUntil: decision.lockedUntil };
  }

  /**
   * A senha da tentativa reservada estava errada. Na primeira vez que a sequência chega ao
   * limite, registra na auditoria e avisa o titular por e-mail, se a conta existir. O e-mail
   * sai fora da resposta: esperar pelo envio deixaria o login mais lento só para quem tem
   * cadastro, e o tempo de resposta revelaria quem tem conta.
   */
  async recordFailure(
    attempt: LoginAttempt,
    account: LoginGuardAccount | null,
    meta: RequestMeta
  ): Promise<void> {
    if (
      attempt.failures !== LOGIN_FAILURE_THRESHOLD ||
      attempt.lockedUntil === null ||
      account === null
    ) {
      return;
    }

    await this.audit.record({
      actorUserId: null,
      action: 'auth.login.locked',
      entityType: 'User',
      entityId: account.id,
      after: { failures: attempt.failures, lockedUntil: attempt.lockedUntil.toISOString() },
      meta
    });
    void this.alertOwner(account);
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
