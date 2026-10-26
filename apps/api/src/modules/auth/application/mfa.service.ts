import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';

import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { decryptField, encryptField } from '../../../common/crypto/data-cipher';
import { verifyPassword } from '../../../common/crypto/password-hasher';
import { base32Encode, generateTotpSecret, totpUri, verifyTotp } from '../../../common/crypto/totp';
import { sha256Hex } from '../../../common/crypto/tokens';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  MFA_ISSUER,
  MFA_RECOVERY_CODE_COUNT,
  normalizeRecoveryCode,
  RECOVERY_CODE_PATTERN,
  REVOCATION
} from '../domain/auth-rules';
import { TrustedDevicesService } from './trusted-devices.service';

export interface MfaStatusView {
  readonly enabled: boolean;
  readonly required: boolean;
  readonly verified: boolean;
  readonly recoveryCodesRemaining: number;
}

export interface MfaSetupView {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly qrSvg: string;
}

const INVALID_CODE = 'Código inválido. Confira o horário do celular e tente de novo.';

function recoveryHash(userId: string, code: string): string {
  return sha256Hex(`mfa-recovery:${userId}:${normalizeRecoveryCode(code)}`);
}

function generateRecoveryCode(): string {
  const raw = base32Encode(randomBytes(8)).slice(0, 12);

  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Login em duas etapas por aplicativo autenticador (TOTP) — DT-037. */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly trustedDevices: TrustedDevicesService
  ) {}

  private encrypt(secret: string): string {
    return encryptField(secret, this.config.values.dataEncryptionKey);
  }

  private decrypt(payload: string): string {
    return decryptField(payload, this.config.values.dataEncryptionKey);
  }

  private async assertPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw AppError.validation('INVALID_CURRENT_PASSWORD', 'Senha atual incorreta.', [
        { field: 'password', code: 'INVALID', message: 'Senha atual incorreta.' }
      ]);
    }
  }

  private async replaceRecoveryCodes(tx: PrismaTx, userId: string): Promise<string[]> {
    const codes = Array.from({ length: MFA_RECOVERY_CODE_COUNT }, generateRecoveryCode);

    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: recoveryHash(userId, code) }))
    });

    return codes;
  }

  async status(principal: Principal): Promise<MfaStatusView> {
    const [user, remaining] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: principal.userId },
        select: { mfaEnabledAt: true }
      }),
      this.prisma.mfaRecoveryCode.count({ where: { userId: principal.userId, usedAt: null } })
    ]);

    return {
      enabled: user.mfaEnabledAt !== null,
      required: principal.privileged,
      verified: principal.mfaVerified,
      recoveryCodesRemaining: remaining
    };
  }

  /** Gera um segredo pendente; só passa a valer após confirmação com um código válido. */
  async beginSetup(principal: Principal, password: string): Promise<MfaSetupView> {
    await this.assertPassword(principal.userId, password);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { mfaEnabledAt: true }
    });

    if (user.mfaEnabledAt !== null) {
      throw AppError.conflict('MFA_ALREADY_ENABLED', 'O login em duas etapas já está ativo.');
    }

    const secret = generateTotpSecret();
    const otpauthUri = totpUri(secret, principal.email, MFA_ISSUER);

    await this.prisma.user.update({
      where: { id: principal.userId },
      data: { mfaPendingSecretEncrypted: this.encrypt(secret) }
    });

    return {
      secret,
      otpauthUri,
      qrSvg: await QRCode.toString(otpauthUri, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1
      })
    };
  }

  /**
   * Confirma o segredo pendente, devolve os códigos de recuperação (exibidos uma única
   * vez), valida a sessão atual e encerra as demais.
   */
  async enable(principal: Principal, code: string, meta: RequestMeta): Promise<string[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { mfaEnabledAt: true, mfaPendingSecretEncrypted: true }
    });

    if (user.mfaEnabledAt !== null) {
      throw AppError.conflict('MFA_ALREADY_ENABLED', 'O login em duas etapas já está ativo.');
    }

    if (user.mfaPendingSecretEncrypted === null) {
      throw AppError.validation('MFA_SETUP_REQUIRED', 'Comece a configuração novamente.');
    }

    const now = new Date();
    const step = verifyTotp(this.decrypt(user.mfaPendingSecretEncrypted), code, now, null);

    if (step === null) {
      throw AppError.validation('INVALID_MFA_CODE', INVALID_CODE, [
        { field: 'code', code: 'INVALID', message: INVALID_CODE }
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: principal.userId },
        data: {
          mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
          mfaEnabledAt: now,
          mfaLastUsedStep: step
        }
      });
      const codes = await this.replaceRecoveryCodes(tx, principal.userId);

      await tx.userSession.update({
        where: { id: principal.sessionId },
        data: { mfaVerifiedAt: now }
      });
      await tx.userSession.updateMany({
        where: { userId: principal.userId, revokedAt: null, id: { not: principal.sessionId } },
        data: { revokedAt: now, revocationReason: REVOCATION.mfaEnabled }
      });
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'auth.mfa.enabled',
          entityType: 'User',
          entityId: principal.userId,
          meta
        },
        tx
      );

      return codes;
    });
  }

  /**
   * Verifica o segundo fator de um usuário com MFA ativo: código TOTP (sem reutilização)
   * ou código de recuperação (uso único).
   */
  async verifySecondFactor(userId: string, code: string): Promise<'TOTP' | 'RECOVERY_CODE' | null> {
    const trimmed = code.trim();

    if (RECOVERY_CODE_PATTERN.test(trimmed.toUpperCase())) {
      const used = await this.prisma.mfaRecoveryCode.updateMany({
        where: { userId, codeHash: recoveryHash(userId, trimmed), usedAt: null },
        data: { usedAt: new Date() }
      });

      return used.count === 1 ? 'RECOVERY_CODE' : null;
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecretEncrypted: true, mfaLastUsedStep: true }
    });

    if (user.mfaSecretEncrypted === null) {
      return null;
    }

    const step = verifyTotp(
      this.decrypt(user.mfaSecretEncrypted),
      trimmed,
      new Date(),
      user.mfaLastUsedStep
    );

    if (step === null) {
      return null;
    }

    // Grava o passo de forma condicional: duas requisições simultâneas com o mesmo código
    // não podem ambas vencer.
    const claimed = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }]
      },
      data: { mfaLastUsedStep: step }
    });

    return claimed.count === 1 ? 'TOTP' : null;
  }

  private async assertSecondFactor(userId: string, code: string): Promise<void> {
    if ((await this.verifySecondFactor(userId, code)) === null) {
      throw AppError.validation('INVALID_MFA_CODE', INVALID_CODE, [
        { field: 'code', code: 'INVALID', message: INVALID_CODE }
      ]);
    }
  }

  async regenerateRecoveryCodes(
    principal: Principal,
    password: string,
    code: string,
    meta: RequestMeta
  ): Promise<string[]> {
    await this.assertPassword(principal.userId, password);
    await this.assertSecondFactor(principal.userId, code);

    return this.prisma.$transaction(async (tx) => {
      const codes = await this.replaceRecoveryCodes(tx, principal.userId);

      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'auth.mfa.recovery_codes.regenerated',
          entityType: 'User',
          entityId: principal.userId,
          meta
        },
        tx
      );

      return codes;
    });
  }

  /** Só contas sem permissão administrativa podem desligar a segunda etapa. */
  async disable(
    principal: Principal,
    password: string,
    code: string,
    meta: RequestMeta
  ): Promise<void> {
    if (principal.privileged) {
      throw new AppError(
        'FORBIDDEN',
        'MFA_MANDATORY',
        'O login em duas etapas é obrigatório para quem acessa o painel.'
      );
    }

    await this.assertPassword(principal.userId, password);
    await this.assertSecondFactor(principal.userId, code);
    await this.prisma.$transaction(async (tx) => {
      await this.clear(tx, principal.userId);
      await this.audit.record(
        {
          actorUserId: principal.userId,
          action: 'auth.mfa.disabled',
          entityType: 'User',
          entityId: principal.userId,
          meta
        },
        tx
      );
    });
  }

  private async clear(tx: PrismaTx, userId: string): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: null,
        mfaPendingSecretEncrypted: null,
        mfaEnabledAt: null,
        mfaLastUsedStep: null
      }
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    // Sem segunda etapa, nenhum navegador lembrado continua valendo (DT-050).
    await this.trustedDevices.forgetAll(userId, 'Segunda etapa desativada ou redefinida', tx);
  }

  /**
   * Redefinição por um administrador quando o titular perde o celular e os códigos.
   * Ninguém redefine a própria segunda etapa; todas as sessões do titular são encerradas.
   */
  async adminReset(
    actor: Principal,
    userId: string,
    reason: string,
    meta: RequestMeta | null
  ): Promise<void> {
    if (actor.userId === userId) {
      throw AppError.forbidden('Você não pode redefinir a sua própria segunda etapa.');
    }

    await this.resetFor(actor.userId, userId, reason, meta);
  }

  /** Usado também pela linha de comando de emergência (`npm run mfa:reset`). */
  async resetFor(
    actorUserId: string | null,
    userId: string,
    reason: string,
    meta: RequestMeta | null
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { mfaEnabledAt: true }
    });

    if (user === null) {
      throw AppError.notFound('Usuário não encontrado.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.clear(tx, userId);
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: REVOCATION.mfaReset }
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'auth.mfa.reset',
          entityType: 'User',
          entityId: userId,
          reason,
          before: { mfaEnabled: user.mfaEnabledAt !== null },
          after: { mfaEnabled: false },
          meta
        },
        tx
      );
    });
  }
}
