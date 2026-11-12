import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../common/config/app-config';
import { ageOn, civilToDate, optionalCivil, todayIn } from '../../../common/domain/civil-date';
import { AppError } from '../../../common/errors/app-error';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  CARD_STATE_LABELS,
  type CardState,
  publicStateLabel,
  shortName
} from '../domain/card-rules';
import {
  cardKey,
  liveValidUntil,
  msToNextWindow,
  signLiveToken,
  signPrintedToken,
  verifyCardToken
} from '../domain/card-token';
import { BenefitsService } from './benefits.service';
import {
  ADULT_AGE,
  CHECK_RETENTION_MS,
  CardDesign,
  CardView,
  CardQr,
  PublicValidation,
  StaffValidation,
  CARD_INCLUDE,
  CardRow
} from './member-card-view';
import { MemberCardReader } from './member-card-view';

/**
 * QR da carteirinha (DT-068): código ao vivo e impresso, validação pública e pela diretoria e
 * registro das conferências, apagado depois do prazo.
 */
@Injectable()
export class MemberCardValidationService {
  private readonly key: Buffer;

  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly benefits: BenefitsService,
    private readonly reader: MemberCardReader,
    config: AppConfig
  ) {
    this.key = cardKey(config.values.dataEncryptionKey);
    this.webOrigin = config.values.webOrigin.replace(/\/$/, '');
  }

  /** QR do celular: muda a cada minuto; só para carteirinha válida. */
  async liveQr(userId: string, id: string, now: Date = new Date()): Promise<CardQr> {
    const row = await this.reader.loadOwned(userId, id);

    if (this.reader.stateOf(row, todayIn(), await this.reader.feeToleranceDays()) !== 'VALID') {
      throw AppError.conflict('CARD_NOT_VALID', 'Esta carteirinha não está válida.');
    }

    return {
      qrSvg: await this.qr(signLiveToken(this.key, row.id, row.version, now)),
      validUntil: liveValidUntil(now).toISOString(),
      refreshInMs: msToNextWindow(now)
    };
  }

  /** QR fixo do impresso: vale até a próxima reemissão (DT-068, impressão). */
  async printed(userId: string, id: string): Promise<CardView & CardQr & { design: CardDesign }> {
    const row = await this.reader.loadOwned(userId, id);
    const today = todayIn();

    if (this.reader.stateOf(row, today, await this.reader.feeToleranceDays()) !== 'VALID') {
      throw AppError.conflict('CARD_NOT_VALID', 'Só é possível imprimir carteirinha válida.');
    }

    return {
      ...(await this.reader.view(row, today, userId)),
      design: await this.reader.design(),
      qrSvg: await this.qr(signPrintedToken(this.key, row.id, row.version)),
      validUntil: null,
      refreshInMs: null
    };
  }

  private qr(token: string): Promise<string> {
    return QRCode.toString(`${this.webOrigin}/validar/${token}`, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1
    });
  }

  private async resolve(
    token: string,
    now: Date
  ): Promise<{
    row: CardRow | null;
    state: CardState | 'UNKNOWN';
    printed: boolean;
    expiredCode: boolean;
  }> {
    const parsed = verifyCardToken(this.key, token.slice(0, 200), now);

    if ('error' in parsed) {
      return {
        row: null,
        state: 'UNKNOWN',
        printed: false,
        expiredCode: parsed.error === 'EXPIRED'
      };
    }

    const row = await this.prisma.memberCard.findUnique({
      where: { id: parsed.cardId },
      include: CARD_INCLUDE
    });

    if (row === null) {
      return { row: null, state: 'UNKNOWN', printed: parsed.printed, expiredCode: false };
    }

    const state =
      row.version !== parsed.version
        ? 'REPLACED'
        : this.reader.stateOf(row, todayIn(), await this.reader.feeToleranceDays());

    return { row, state, printed: parsed.printed, expiredCode: false };
  }

  private async recordCheck(
    cardId: string,
    state: CardState,
    byStaff: boolean,
    printed: boolean
  ): Promise<void> {
    await this.prisma.memberCardCheck.create({
      data: {
        cardId,
        valid: state === 'VALID',
        reason: state === 'VALID' ? null : state,
        byStaff,
        printed
      }
    });
  }

  /** Quem confere sem login (parceiro): o mínimo para conferir e os benefícios (DT-068 C). */
  async validatePublic(token: string, now: Date = new Date()): Promise<PublicValidation> {
    const checkedAt = now.toISOString();
    const { row, state, printed, expiredCode } = await this.resolve(token, now);

    if (row === null || state === 'UNKNOWN') {
      return {
        valid: false,
        label: expiredCode
          ? 'Código vencido: peça para abrir a carteirinha de novo (o QR muda a cada minuto).'
          : 'Inválida',
        checkedAt,
        card: null
      };
    }

    await this.recordCheck(row.id, state, false, printed);

    if (state !== 'VALID') {
      return { valid: false, label: publicStateLabel(state), checkedAt, card: null };
    }

    const today = todayIn();
    const birth = optionalCivil(row.athlete?.birthDate);
    const minor = birth !== null && ageOn(birth, today) < ADULT_AGE;
    const showPhoto = !minor || row.athlete?.publicProfileConsentAt != null;
    const name = row.athlete?.fullName ?? row.holderName;

    return {
      valid: true,
      label: 'Válida',
      checkedAt,
      card: {
        type: row.type,
        name: shortName(name, minor && !showPhoto),
        photo: showPhoto ? await this.reader.photo(row.holderUser?.avatarMediaFileId) : null,
        minorWithoutPhoto: minor && !showPhoto,
        endsOn: optionalCivil(row.endsOn),
        benefits: await this.benefits.forCard(row.type, today)
      }
    };
  }

  /** Diretoria logada: situação completa e, com permissão, mensalidade em dia. */
  async validateStaff(
    principal: Principal,
    token: string,
    meta: RequestMeta,
    now: Date = new Date()
  ): Promise<StaffValidation> {
    const checkedAt = now.toISOString();
    const { row, state, printed, expiredCode } = await this.resolve(token, now);

    if (row === null || state === 'UNKNOWN') {
      return {
        valid: false,
        state: 'UNKNOWN',
        label: expiredCode
          ? 'Código vencido: peça para abrir a carteirinha de novo (o QR muda a cada minuto).'
          : 'Código inválido: não é uma carteirinha do clube.',
        checkedAt,
        card: null
      };
    }

    await this.recordCheck(row.id, state, true, printed);
    await this.audit.record({
      actorUserId: principal.userId,
      action: 'cards.checked',
      entityType: 'MemberCard',
      entityId: row.id,
      after: { state, printed },
      meta
    });

    const today = todayIn();
    const feesUpToDate =
      row.athleteId && principal.permissions.has(PERMISSIONS.feesRead)
        ? (await this.prisma.monthlyFee.count({
            where: {
              athleteId: row.athleteId,
              status: { in: ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'] },
              dueDate: { lt: civilToDate(today) }
            }
          })) === 0
        : null;

    return {
      valid: state === 'VALID',
      state,
      label: CARD_STATE_LABELS[state],
      checkedAt,
      card: {
        ...(await this.reader.view(row, today, null)),
        feesUpToDate,
        athleteStatus: row.athlete?.status ?? null
      }
    };
  }

  async purgeChecks(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.memberCardCheck.deleteMany({
      where: { checkedAt: { lt: new Date(now.getTime() - CHECK_RETENTION_MS) } }
    });

    return count;
  }
}
