import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

import { AuditService } from '../../../common/audit/audit.service';
import { civilToDate, dateToCivil } from '../../../common/domain/civil-date';
import { money } from '../../../common/domain/money';
import {
  civilDateOf,
  endOfDayExclusive,
  startOfDayInZone,
  TEAM_TIME_ZONE
} from '../../../common/domain/time-zone';
import { AppError } from '../../../common/errors/app-error';
import { type Page, pageArgs, type PageQueryDto, toPage } from '../../../common/http/pagination';
import type { Principal, RequestMeta } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import { SYSTEM_ROLES } from '../../access/domain/permission-catalog';
import {
  type AccountabilityContent,
  type AccountOpening,
  buildAccountability,
  consistencyProblems,
  contentHash,
  type LedgerRow,
  normalizeVerificationCode,
  periodProblem,
  reportNumber,
  type Signatory,
  SNAPSHOT_FORMAT,
  verificationCode
} from '../domain/accountability';
import type { AccountabilitySnapshot } from '../domain/accountability-snapshot';
import {
  accountabilityFileName,
  renderAccountabilityPdf
} from '../infrastructure/accountability-pdf';

/** Saída que pode mostrar a descrição do Caixa (com quem recebeu), à escolha da diretoria. */
export interface ExpenseCandidate {
  readonly transactionId: string;
  readonly description: string;
  readonly counterpartyName: string | null;
}

export interface BoardMember {
  readonly userId: string;
  readonly name: string;
  readonly position: string | null;
}

export interface AccountabilityPreview {
  readonly content: AccountabilityContent;
  readonly problems: readonly string[];
  readonly expenseCandidates: readonly ExpenseCandidate[];
  readonly boardMembers: readonly BoardMember[];
  /** Há dias do período sem fechamento de caixa: os lançamentos ainda podem mudar. */
  readonly unclosedAccounts: number;
}

export interface AccountabilityRow {
  readonly id: string;
  readonly number: string;
  readonly revision: number;
  readonly status: 'ISSUED' | 'REPLACED';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly verificationCode: string;
  readonly issuedAt: string;
  readonly issuedBy: string | null;
  readonly closingBalance: string;
  readonly replacedById: string | null;
}

export interface AccountabilityDetail extends AccountabilityRow {
  readonly snapshot: AccountabilitySnapshot;
  readonly contentHash: string;
  readonly replacementReason: string | null;
}

export interface IssueInput {
  readonly from: string;
  readonly to: string;
  readonly showDetailFor: readonly string[];
  readonly signatoryUserIds?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly replacesId?: string | undefined;
  readonly replacementReason?: string | undefined;
}

const REPORT_SELECT = {
  id: true,
  number: true,
  revision: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  verificationCode: true,
  issuedAt: true,
  snapshot: true,
  contentHash: true,
  replacementReason: true,
  issuedBy: { select: { name: true } },
  replacedBy: { select: { id: true } }
} satisfies Prisma.AccountabilityReportSelect;

type ReportRow = Prisma.AccountabilityReportGetPayload<{ select: typeof REPORT_SELECT }>;

function asSnapshot(value: Prisma.JsonValue): AccountabilitySnapshot {
  return value as unknown as AccountabilitySnapshot;
}

/**
 * Prestação de contas (DT-103): prévia calculada do Caixa, emissão congelada com hash,
 * versão corrigida que substitui a anterior sem apagá-la, PDF e conferência pelo código.
 */
@Injectable()
export class AccountabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertPeriod(from: string, to: string): void {
    const problem = periodProblem(from, to);

    if (problem) {
      throw AppError.validation('INVALID_PERIOD', problem, [
        { field: 'to', code: 'INVALID_PERIOD', message: problem }
      ]);
    }
  }

  /** Lançamentos confirmados e saldos de abertura do período, no fuso do time. */
  private async gather(
    client: PrismaTx | PrismaService,
    from: string,
    to: string
  ): Promise<{ accounts: AccountOpening[]; rows: LedgerRow[]; candidates: ExpenseCandidate[] }> {
    const start = startOfDayInZone(from);
    const end = endOfDayExclusive(to);
    const [accounts, before, transactions] = await Promise.all([
      // Contas excluídas também: o histórico delas conta (DT-062, DT-065).
      client.financialAccount.findMany({ select: { id: true, name: true } }),
      client.financialTransaction.groupBy({
        by: ['accountId', 'direction'],
        where: { status: 'CONFIRMED', occurredAt: { lt: start } },
        _sum: { amount: true }
      }),
      client.financialTransaction.findMany({
        where: { status: 'CONFIRMED', occurredAt: { gte: start, lt: end } },
        select: {
          id: true,
          accountId: true,
          direction: true,
          origin: true,
          amount: true,
          occurredAt: true,
          description: true,
          category: { select: { name: true } },
          settledObligation: { select: { counterpartyName: true } }
        }
      })
    ]);
    const openingOf = (accountId: string) => {
      const income =
        before.find((g) => g.accountId === accountId && g.direction === 'INCOME')?._sum.amount ??
        money(0);
      const expense =
        before.find((g) => g.accountId === accountId && g.direction === 'EXPENSE')?._sum.amount ??
        money(0);

      return money(income).minus(expense).toFixed(2);
    };
    const rows: LedgerRow[] = transactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      direction: t.direction,
      origin: t.origin,
      amount: t.amount.toFixed(2),
      date: civilDateOf(t.occurredAt ?? start),
      categoryName: t.category.name,
      description: t.description,
      counterpartyName: t.settledObligation?.counterpartyName ?? null
    }));

    return {
      accounts: accounts.map((a) => ({
        accountId: a.id,
        accountName: a.name,
        opening: openingOf(a.id)
      })),
      rows,
      candidates: rows
        .filter(
          (row) =>
            row.direction === 'EXPENSE' &&
            ['MANUAL', 'ADJUSTMENT', 'PARTNER_SETTLEMENT'].includes(row.origin)
        )
        .map((row) => ({
          transactionId: row.id,
          description: row.description,
          counterpartyName: row.counterpartyName
        }))
    };
  }

  private async currency(client: PrismaTx | PrismaService): Promise<string> {
    const settings = await client.teamSettings.findFirst({ select: { defaultCurrency: true } });

    return settings?.defaultCurrency ?? 'BRL';
  }

  /** Pessoas com o papel Diretoria vigente e conta ativa, para as assinaturas. */
  async boardMembers(client: PrismaTx | PrismaService = this.prisma): Promise<BoardMember[]> {
    const now = new Date();
    const users = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        userRoles: {
          some: {
            role: { code: SYSTEM_ROLES.board, deletedAt: null },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          }
        }
      },
      select: { id: true, name: true, boardPosition: true },
      orderBy: { name: 'asc' }
    });

    // Quem tem cargo primeiro (Presidente, Tesoureiro(a)...), depois pelo nome.
    return users
      .map((u) => ({ userId: u.id, name: u.name, position: u.boardPosition }))
      .sort(
        (a, b) =>
          Number(a.position === null) - Number(b.position === null) ||
          a.name.localeCompare(b.name, 'pt-BR')
      );
  }

  async preview(
    from: string,
    to: string,
    showDetailFor: readonly string[]
  ): Promise<AccountabilityPreview> {
    this.assertPeriod(from, to);

    const [{ accounts, rows, candidates }, currency, boardMembers, unclosedAccounts] =
      await Promise.all([
        this.gather(this.prisma, from, to),
        this.currency(this.prisma),
        this.boardMembers(),
        this.unclosedAccounts(to)
      ]);
    const content = buildAccountability({
      from,
      to,
      timeZone: TEAM_TIME_ZONE,
      currency,
      accounts,
      rows,
      showDetailFor: new Set(showDetailFor)
    });

    return {
      content,
      problems: consistencyProblems(content),
      expenseCandidates: candidates,
      boardMembers,
      unclosedAccounts
    };
  }

  /** Contas ativas sem fechamento de caixa cobrindo o fim do período (aviso, não bloqueio). */
  private async unclosedAccounts(to: string): Promise<number> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        cashClosings: {
          where: { status: 'CLOSED', periodEnd: { gte: civilToDate(to) } },
          select: { id: true },
          take: 1
        }
      }
    });

    return accounts.filter((account) => account.cashClosings.length === 0).length;
  }

  async issue(
    actor: Principal,
    input: IssueInput,
    idempotencyKey: string,
    meta: RequestMeta
  ): Promise<AccountabilityDetail> {
    this.assertPeriod(input.from, input.to);

    const key = `accountability:${actor.userId}:${idempotencyKey}`.slice(0, 200);
    const repeated = await this.prisma.accountabilityReport.findUnique({
      where: { idempotencyKey: key },
      select: { id: true }
    });

    if (repeated) {
      return this.get(repeated.id);
    }

    const id = await this.prisma.$transaction(async (tx) => {
      // Uma emissão por vez: o número sai em sequência, sem buraco nem repetição.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('accountability-number'))`;

      const issuer = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { name: true, boardPosition: true }
      });
      const replaced = input.replacesId
        ? await tx.accountabilityReport.findUnique({
            where: { id: input.replacesId },
            select: { id: true, number: true, revision: true, status: true }
          })
        : null;

      if (input.replacesId && replaced === null) {
        throw AppError.notFound('Prestação de contas a corrigir não encontrada.');
      }

      if (replaced && replaced.status !== 'ISSUED') {
        throw AppError.conflict(
          'ALREADY_REPLACED',
          'Esta prestação de contas já foi corrigida. Corrija a versão mais recente.'
        );
      }

      const reason = input.replacementReason?.trim() ?? '';

      if (replaced && reason.length < 10) {
        throw AppError.validation('REASON_REQUIRED', 'Explique o que foi corrigido.', [
          { field: 'replacementReason', code: 'REQUIRED', message: 'Explique o que foi corrigido.' }
        ]);
      }

      const board = await this.boardMembers(tx);
      const chosen = input.signatoryUserIds;

      if (chosen && chosen.some((userId) => !board.some((m) => m.userId === userId))) {
        throw AppError.validation(
          'INVALID_SIGNATORY',
          'Só quem é da diretoria pode assinar a prestação de contas.',
          [{ field: 'signatoryUserIds', code: 'INVALID', message: 'Escolha pessoas da diretoria.' }]
        );
      }

      const signatories: Signatory[] = (
        chosen ? board.filter((m) => chosen.includes(m.userId)) : board
      ).map((m) => ({ name: m.name, position: m.position }));
      const [{ accounts, rows }, currency, settings] = await Promise.all([
        this.gather(tx, input.from, input.to),
        this.currency(tx),
        tx.teamSettings.findFirst({ select: { teamName: true, officialName: true } })
      ]);
      const content = buildAccountability({
        from: input.from,
        to: input.to,
        timeZone: TEAM_TIME_ZONE,
        currency,
        accounts,
        rows,
        showDetailFor: new Set(input.showDetailFor)
      });
      const problems = consistencyProblems(content);

      if (problems.length > 0) {
        throw AppError.conflict('INCONSISTENT', problems.join(' '));
      }

      const issuedAt = new Date();
      const year = Number(civilDateOf(issuedAt).slice(0, 4));
      const number =
        replaced?.number ??
        reportNumber(
          year,
          (await tx.accountabilityReport.count({
            where: { revision: 1, number: { startsWith: `PC-${year}-` } }
          })) + 1
        );
      const revision = replaced ? replaced.revision + 1 : 1;
      const snapshot: AccountabilitySnapshot = {
        format: SNAPSHOT_FORMAT,
        number,
        revision,
        team: {
          name: settings?.teamName ?? 'Fênix Vôlei',
          officialName: settings?.officialName ?? settings?.teamName ?? 'Fênix Vôlei'
        },
        issuedAt: issuedAt.toISOString(),
        issuedBy: { name: issuer.name, position: issuer.boardPosition },
        replaces: replaced ? { revision: replaced.revision, reason } : null,
        content,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        signatories
      };
      const hash = contentHash(snapshot);
      const created = await tx.accountabilityReport.create({
        data: {
          number,
          revision,
          periodStart: civilToDate(input.from),
          periodEnd: civilToDate(input.to),
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          contentHash: hash,
          verificationCode: hash.slice(0, 12),
          idempotencyKey: key,
          issuedById: actor.userId,
          issuedAt,
          ...(replaced ? { replacesId: replaced.id, replacementReason: reason } : {})
        },
        select: { id: true }
      });

      if (replaced) {
        await tx.accountabilityReport.update({
          where: { id: replaced.id },
          data: { status: 'REPLACED' }
        });
        await this.audit.record(
          {
            actorUserId: actor.userId,
            action: 'accountability.replaced',
            entityType: 'AccountabilityReport',
            entityId: replaced.id,
            reason,
            before: { status: 'ISSUED' },
            after: { status: 'REPLACED', replacedBy: created.id, revision },
            meta
          },
          tx
        );
      }

      await this.audit.record(
        {
          actorUserId: actor.userId,
          action: 'accountability.issued',
          entityType: 'AccountabilityReport',
          entityId: created.id,
          after: {
            number,
            revision,
            period: { from: input.from, to: input.to },
            closingBalance: content.closingBalance.amount,
            detailsShown: content.expense.lines.filter((line) => line.detail !== null).length,
            signatories: signatories.length,
            verificationCode: verificationCode(hash)
          },
          meta
        },
        tx
      );

      return created.id;
    });

    return this.get(id);
  }

  private row(report: ReportRow): AccountabilityRow {
    const snapshot = asSnapshot(report.snapshot);

    return {
      id: report.id,
      number: report.number,
      revision: report.revision,
      status: report.status,
      periodStart: dateToCivil(report.periodStart),
      periodEnd: dateToCivil(report.periodEnd),
      verificationCode: verificationCode(report.contentHash),
      issuedAt: report.issuedAt.toISOString(),
      issuedBy: report.issuedBy?.name ?? snapshot.issuedBy.name,
      closingBalance: snapshot.content.closingBalance.amount,
      replacedById: report.replacedBy?.id ?? null
    };
  }

  async list(query: PageQueryDto): Promise<Page<AccountabilityRow>> {
    const { skip, take, page, pageSize } = pageArgs(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.accountabilityReport.findMany({
        select: REPORT_SELECT,
        orderBy: [{ issuedAt: 'desc' }],
        skip,
        take
      }),
      this.prisma.accountabilityReport.count()
    ]);

    return toPage(
      rows.map((row) => this.row(row)),
      total,
      page,
      pageSize
    );
  }

  async get(id: string): Promise<AccountabilityDetail> {
    const report = await this.prisma.accountabilityReport.findUnique({
      where: { id },
      select: REPORT_SELECT
    });

    if (report === null) {
      throw AppError.notFound('Prestação de contas não encontrada.');
    }

    return {
      ...this.row(report),
      snapshot: asSnapshot(report.snapshot),
      contentHash: report.contentHash,
      replacementReason: report.replacementReason
    };
  }

  /** PDF a partir do retrato congelado; cada download fica na auditoria. */
  async pdf(
    actor: Principal,
    id: string,
    meta: RequestMeta
  ): Promise<{ fileName: string; content: Buffer }> {
    const report = await this.get(id);

    // O retrato guardado precisa ser exatamente o emitido.
    if (contentHash(report.snapshot) !== report.contentHash) {
      throw AppError.conflict(
        'TAMPERED',
        'O conteúdo guardado não confere com o código de conferência. Fale com o administrador.'
      );
    }

    const content = await renderAccountabilityPdf(report.snapshot, report.contentHash);

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'accountability.downloaded',
      entityType: 'AccountabilityReport',
      entityId: id,
      after: { number: report.number, revision: report.revision },
      meta
    });

    return { fileName: accountabilityFileName(report.snapshot), content };
  }

  /** Confere um código impresso: qual documento é, e se é a versão em vigor. */
  async verify(code: string): Promise<AccountabilityRow | null> {
    const normalized = normalizeVerificationCode(code);

    if (normalized === null) {
      throw AppError.validation(
        'INVALID_CODE',
        'O código tem 12 letras e números (ex.: 1A2B-3C4D-5E6F).'
      );
    }

    const report = await this.prisma.accountabilityReport.findFirst({
      where: { verificationCode: normalized },
      select: REPORT_SELECT
    });

    return report ? this.row(report) : null;
  }
}
