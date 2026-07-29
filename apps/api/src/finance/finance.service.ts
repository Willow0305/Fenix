import { createHash } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashSessionStatus,
  FinancialAccountType,
  FinancialCategoryType,
  FinancialChargeStatus,
  FinancialObligationStatus,
  FinancialObligationType,
  FinancialPaymentStatus,
  FinancialSurplusDisposition,
  FinancialTransactionStatus,
  FinancialTransactionType,
  FinancialTransferStatus,
  PaymentCreditStatus,
  Prisma,
  PrivateAttachmentStatus
} from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import type { RequestWithPrincipal } from '../common/http/request-with-principal';
import { PrismaService } from '../database/prisma.service';
import type { CloseCashSessionDto, OpenCashSessionDto } from './dto/cash.dto';
import type {
  CreateCostCenterDto,
  CreateFinancialAccountDto,
  CreateFinancialCategoryDto
} from './dto/catalog.dto';
import type { FinanceQueryDto } from './dto/finance-query.dto';
import type {
  CreateFinancialObligationDto,
  CreateFinancialTransferDto,
  CreatePendingFinancialTransactionDto,
  FinancialDecisionDto
} from './dto/ledger.dto';
import type {
  CreateFinancialChargeDto,
  CreateFinancialPlanDto,
  CreateFinancialPlanVersionDto
} from './dto/plan-charge.dto';
import type { CreateFinancialPaymentDto, ReconcileFinancialPaymentDto } from './dto/payment.dto';
import {
  calculateCashClosing,
  determineChargeSettlement,
  evaluateReconciliation,
  parseMoneyToUnits
} from './domain';

const MAX_SERIALIZABLE_ATTEMPTS = 4;

function asDecimal(value: string): Prisma.Decimal {
  parseMoneyToUnits(value);

  return new Prisma.Decimal(value);
}

function asNonnegativeDecimal(value: string): Prisma.Decimal {
  parseMoneyToUnits(value, { allowZero: true });

  return new Prisma.Decimal(value);
}

function money(value: Prisma.Decimal): string {
  return value.toFixed(4);
}

function toCivilDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ConflictException({
      code: 'FINANCE_CIVIL_DATE_INVALID',
      message: 'A data civil informada é inválida.'
    });
  }

  return date;
}

function civilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function idempotencyHash(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function derivedIdempotencyHash(key: string, purpose: string): string {
  return createHash('sha256').update(`${purpose}:${key}`, 'utf8').digest('hex');
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === 'P2034' || (error.code === 'P2010' && error.meta?.['code'] === '40001');
}

function duplicateConflict(): ConflictException {
  return new ConflictException({
    code: 'FINANCE_RECORD_ALREADY_EXISTS',
    message: 'Já existe um registro financeiro com o identificador informado.'
  });
}

@Injectable()
export class FinanceService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  public async summary() {
    const [accounts, openCharges, pendingPayments, pendingEntries, openCashSessions, approvedRows] =
      await Promise.all([
        this.prisma.financialAccount.count({ where: { isActive: true, deletedAt: null } }),
        this.prisma.financialCharge.count({
          where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } }
        }),
        this.prisma.financialPayment.count({ where: { status: FinancialPaymentStatus.PENDING } }),
        this.prisma.financialTransaction.count({
          where: { status: FinancialTransactionStatus.PENDING }
        }),
        this.prisma.cashSession.count({ where: { status: CashSessionStatus.OPEN } }),
        this.prisma.financialTransaction.findMany({
          where: {
            status: {
              in: [FinancialTransactionStatus.APPROVED, FinancialTransactionStatus.REVERSED]
            }
          },
          include: { category: true, reversalOf: { include: { category: true } } }
        })
      ]);
    const balance = approvedRows.reduce(
      (total, transaction) => total.add(this.transactionEffect(transaction)),
      new Prisma.Decimal(0)
    );

    return {
      currency: 'BRL',
      accounts,
      openCharges,
      pendingPayments,
      pendingEntries,
      openCashSessions,
      derivedBalance: money(balance)
    };
  }

  public async listAccounts(query: FinanceQueryDto) {
    const records = await this.prisma.financialAccount.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(
      records,
      query.limit,
      ({ id, code, name, type, currency, isActive, createdAt }) => ({
        id,
        code,
        name,
        type,
        currency,
        isActive,
        createdAt: createdAt.toISOString()
      })
    );
  }

  public async createAccount(
    input: CreateFinancialAccountDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    try {
      const account = await this.prisma.$transaction(async (database) => {
        const created = await database.financialAccount.create({
          data: {
            code: input.code.trim().toLocaleUpperCase('pt-BR'),
            name: input.name.trim(),
            type: input.type,
            currency: 'BRL',
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeAccountCreated,
            actorUserId,
            entityType: 'FinancialAccount',
            entityId: created.id,
            afterData: { code: created.code, type: created.type, currency: created.currency },
            request
          },
          database
        );

        return created;
      });

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        currency: account.currency,
        isActive: account.isActive
      };
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listCategories(query: FinanceQueryDto) {
    const records = await this.prisma.financialCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, ({ id, code, name, type, isActive, createdAt }) => ({
      id,
      code,
      name,
      type,
      isActive,
      createdAt: createdAt.toISOString()
    }));
  }

  public async createCategory(
    input: CreateFinancialCategoryDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    try {
      return await this.prisma.$transaction(async (database) => {
        const category = await database.financialCategory.create({
          data: {
            code: input.code.trim().toLocaleUpperCase('pt-BR'),
            name: input.name.trim(),
            type: input.type,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeCategoryCreated,
            actorUserId,
            entityType: 'FinancialCategory',
            entityId: category.id,
            afterData: { code: category.code, type: category.type },
            request
          },
          database
        );

        return {
          id: category.id,
          code: category.code,
          name: category.name,
          type: category.type,
          isActive: category.isActive
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listCostCenters(query: FinanceQueryDto) {
    const records = await this.prisma.costCenter.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, ({ id, code, name, isActive, createdAt }) => ({
      id,
      code,
      name,
      isActive,
      createdAt: createdAt.toISOString()
    }));
  }

  public async createCostCenter(
    input: CreateCostCenterDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    try {
      return await this.prisma.$transaction(async (database) => {
        const center = await database.costCenter.create({
          data: {
            code: input.code.trim().toLocaleUpperCase('pt-BR'),
            name: input.name.trim(),
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeCostCenterCreated,
            actorUserId,
            entityType: 'CostCenter',
            entityId: center.id,
            afterData: { code: center.code },
            request
          },
          database
        );

        return {
          id: center.id,
          code: center.code,
          name: center.name,
          isActive: center.isActive
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listPlans(query: FinanceQueryDto) {
    const records = await this.prisma.financialPlan.findMany({
      where: { deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      versions: plan.versions.map((version) => ({
        id: version.id,
        version: version.version,
        amount: money(version.amount),
        currency: version.currency,
        billingDay: version.billingDay,
        effectiveFrom: civilDate(version.effectiveFrom),
        rulesSnapshot: version.rulesSnapshot,
        createdAt: version.createdAt.toISOString()
      }))
    }));
  }

  public async createPlan(
    input: CreateFinancialPlanDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    try {
      return await this.prisma.$transaction(async (database) => {
        const plan = await database.financialPlan.create({
          data: {
            code: input.code.trim().toLocaleUpperCase('pt-BR'),
            name: input.name.trim(),
            description: input.description?.trim() ?? null,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financePlanCreated,
            actorUserId,
            entityType: 'FinancialPlan',
            entityId: plan.id,
            afterData: { code: plan.code, status: plan.status },
            request
          },
          database
        );

        return {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          status: plan.status,
          versions: []
        };
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async createPlanVersion(
    planId: string,
    input: CreateFinancialPlanVersionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const createdId = await this.withSerializableRetry(async (database) => {
      await database.$queryRaw`
        SELECT "id" FROM "financial_plans" WHERE "id" = ${planId}::uuid FOR UPDATE
      `;
      const plan = await database.financialPlan.findUnique({ where: { id: planId } });

      if (!plan || plan.deletedAt) {
        throw this.notFound('FINANCIAL_PLAN_NOT_FOUND', 'Plano financeiro não encontrado.');
      }

      const latest = await database.financialPlanVersion.findFirst({
        where: { planId },
        orderBy: { version: 'desc' }
      });
      const version = await database.financialPlanVersion.create({
        data: {
          planId,
          version: (latest?.version ?? 0) + 1,
          amount: asDecimal(input.amount),
          currency: 'BRL',
          billingDay: input.billingDay,
          effectiveFrom: toCivilDate(input.effectiveFrom),
          ...(input.rulesSummary ? { rulesSnapshot: { summary: input.rulesSummary.trim() } } : {}),
          createdById: actorUserId
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financePlanVersionCreated,
          actorUserId,
          entityType: 'FinancialPlanVersion',
          entityId: version.id,
          afterData: { planId, version: version.version, currency: version.currency },
          request
        },
        database
      );

      return version.id;
    });
    const version = await this.prisma.financialPlanVersion.findUniqueOrThrow({
      where: { id: createdId }
    });

    return {
      id: version.id,
      planId: version.planId,
      version: version.version,
      amount: money(version.amount),
      currency: version.currency,
      billingDay: version.billingDay,
      effectiveFrom: civilDate(version.effectiveFrom)
    };
  }

  public async listCharges(query: FinanceQueryDto) {
    const records = await this.prisma.financialCharge.findMany({
      where: { deletedAt: null },
      include: { allocations: true, planVersion: { include: { plan: true } } },
      orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (charge) => this.mapCharge(charge));
  }

  public async createCharge(
    input: CreateFinancialChargeDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const keyHash = idempotencyHash(idempotencyKey);
    const existing = await this.prisma.financialCharge.findUnique({
      where: { idempotencyKeyHash: keyHash },
      include: { allocations: true, planVersion: { include: { plan: true } } }
    });

    if (existing) {
      this.ensureChargeIdempotency(existing, input);

      return this.mapCharge(existing);
    }

    const amount = asDecimal(input.amount);

    if (input.planVersionId) {
      const planVersion = await this.prisma.financialPlanVersion.findUnique({
        where: { id: input.planVersionId }
      });

      if (!planVersion) {
        throw this.notFound(
          'FINANCIAL_PLAN_VERSION_NOT_FOUND',
          'Versão de plano financeiro não encontrada.'
        );
      }

      if (!planVersion.amount.equals(amount)) {
        throw new ConflictException({
          code: 'FINANCIAL_CHARGE_PLAN_SNAPSHOT_MISMATCH',
          message: 'A cobrança deve preservar o valor exato da versão do plano.'
        });
      }
    }

    try {
      const chargeId = await this.prisma.$transaction(async (database) => {
        const charge = await database.financialCharge.create({
          data: {
            referenceCode: input.referenceCode.trim().toLocaleUpperCase('pt-BR'),
            planVersionId: input.planVersionId ?? null,
            description: input.description.trim(),
            competence: toCivilDate(input.competence),
            dueDate: toCivilDate(input.dueDate),
            originalAmount: amount,
            currency: 'BRL',
            idempotencyKeyHash: keyHash,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeChargeCreated,
            actorUserId,
            entityType: 'FinancialCharge',
            entityId: charge.id,
            afterData: {
              referenceCode: charge.referenceCode,
              competence: civilDate(charge.competence),
              currency: charge.currency,
              planVersionId: charge.planVersionId
            },
            request
          },
          database
        );

        return charge.id;
      });

      return this.getMappedCharge(chargeId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.prisma.financialCharge.findUnique({
          where: { idempotencyKeyHash: keyHash },
          include: { allocations: true, planVersion: { include: { plan: true } } }
        });

        if (raced) {
          this.ensureChargeIdempotency(raced, input);

          return this.mapCharge(raced);
        }

        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listPayments(query: FinanceQueryDto) {
    const records = await this.prisma.financialPayment.findMany({
      include: {
        account: true,
        allocations: { include: { charge: true } },
        credit: true,
        reconciliation: true,
        surplus: true
      },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (payment) => this.mapPayment(payment));
  }

  public async createPayment(
    input: CreateFinancialPaymentDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const keyHash = idempotencyHash(idempotencyKey);
    const existing = await this.findPaymentByIdempotency(keyHash);

    if (existing) {
      this.ensurePaymentIdempotency(existing, input);

      return this.mapPayment(existing);
    }

    const account = await this.findAccount(input.accountId);

    if (input.privateAttachmentId) {
      const attachment = await this.prisma.privateAttachment.findUnique({
        where: { id: input.privateAttachmentId }
      });

      if (
        !attachment ||
        attachment.status !== PrivateAttachmentStatus.AVAILABLE ||
        attachment.removedAt
      ) {
        throw new ConflictException({
          code: 'FINANCIAL_RECEIPT_ATTACHMENT_UNAVAILABLE',
          message: 'O metadado privado do comprovante não está disponível.'
        });
      }
    }

    try {
      const paymentId = await this.prisma.$transaction(async (database) => {
        const payment = await database.financialPayment.create({
          data: {
            accountId: account.id,
            privateAttachmentId: input.privateAttachmentId ?? null,
            externalReference: input.externalReference?.trim() ?? null,
            amount: asDecimal(input.amount),
            paidAt: new Date(input.paidAt),
            currency: 'BRL',
            status: FinancialPaymentStatus.PENDING,
            idempotencyKeyHash: keyHash,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financePaymentCreated,
            actorUserId,
            entityType: 'FinancialPayment',
            entityId: payment.id,
            afterData: {
              accountId: payment.accountId,
              currency: payment.currency,
              status: payment.status,
              hasPrivateReceipt: Boolean(payment.privateAttachmentId)
            },
            request
          },
          database
        );

        return payment.id;
      });

      return this.getMappedPayment(paymentId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.findPaymentByIdempotency(keyHash);

        if (raced) {
          this.ensurePaymentIdempotency(raced, input);

          return this.mapPayment(raced);
        }

        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async reconcilePayment(
    paymentId: string,
    input: ReconcileFinancialPaymentDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const reconciliationHash = idempotencyHash(idempotencyKey);
    const category = await this.findCategory(input.incomeCategoryId);

    if (category.type !== FinancialCategoryType.INCOME) {
      throw new ConflictException({
        code: 'PAYMENT_RECONCILIATION_REQUIRES_INCOME_CATEGORY',
        message: 'A conciliação de pagamento exige categoria de entrada.'
      });
    }

    await this.withSerializableRetry(async (database) => {
      await database.$queryRaw`
        SELECT "id" FROM "financial_payments" WHERE "id" = ${paymentId}::uuid FOR UPDATE
      `;
      const payment = await database.financialPayment.findUnique({
        where: { id: paymentId },
        include: {
          reconciliation: { include: { allocations: true } },
          surplus: true,
          transactions: {
            where: { type: FinancialTransactionType.INCOME },
            select: { categoryId: true }
          }
        }
      });

      if (!payment) {
        throw this.notFound('FINANCIAL_PAYMENT_NOT_FOUND', 'Pagamento não encontrado.');
      }

      if (payment.reconciliation) {
        if (payment.reconciliation.idempotencyKeyHash !== reconciliationHash) {
          throw new ConflictException({
            code: 'PAYMENT_ALREADY_RECONCILED',
            message: 'O pagamento já possui conciliação definitiva.'
          });
        }

        this.ensureReconciliationIdempotency(
          {
            allocations: payment.reconciliation.allocations,
            categoryId: payment.transactions[0]?.categoryId ?? null,
            surplusDisposition: payment.surplus?.disposition ?? null
          },
          input
        );

        return;
      }

      if (payment.status !== FinancialPaymentStatus.PENDING) {
        throw new ConflictException({
          code: 'PAYMENT_NOT_PENDING',
          message: 'Somente pagamento pendente pode ser conciliado.'
        });
      }

      const uniqueChargeIds = new Set(input.allocations.map(({ chargeId }) => chargeId));

      if (uniqueChargeIds.size !== input.allocations.length) {
        throw new ConflictException({
          code: 'PAYMENT_ALLOCATION_DUPLICATE_CHARGE',
          message: 'Uma cobrança não pode aparecer duas vezes na mesma conciliação.'
        });
      }

      const charges = await database.financialCharge.findMany({
        where: { id: { in: [...uniqueChargeIds] }, deletedAt: null },
        include: { allocations: true }
      });

      if (charges.length !== uniqueChargeIds.size) {
        throw this.notFound(
          'FINANCIAL_CHARGE_NOT_FOUND',
          'Uma ou mais cobranças não foram encontradas.'
        );
      }

      for (const charge of charges) {
        await database.$queryRaw`
          SELECT "id" FROM "financial_charges" WHERE "id" = ${charge.id}::uuid FOR UPDATE
        `;
      }

      const outcome = evaluateReconciliation({
        paymentAmount: money(payment.amount),
        allocationAmounts: input.allocations.map(({ amount }) => amount),
        ...(input.surplusDisposition ? { surplusDisposition: input.surplusDisposition } : {})
      });
      const chargeById = new Map(charges.map((charge) => [charge.id, charge]));

      for (const allocation of input.allocations) {
        const charge = chargeById.get(allocation.chargeId);

        if (!charge || charge.status === FinancialChargeStatus.CANCELLED) {
          throw new ConflictException({
            code: 'FINANCIAL_CHARGE_NOT_OPEN',
            message: 'A cobrança informada não aceita nova alocação.'
          });
        }

        const alreadyAllocated = charge.allocations.reduce(
          (total, item) => total.add(item.amount),
          new Prisma.Decimal(0)
        );
        const nextAllocated = alreadyAllocated.add(asDecimal(allocation.amount));

        if (nextAllocated.gt(charge.originalAmount)) {
          throw new ConflictException({
            code: 'PAYMENT_ALLOCATION_EXCEEDS_CHARGE',
            message: 'A alocação supera o saldo aberto de uma cobrança.'
          });
        }
      }

      const reconciliation = await database.financialReconciliation.create({
        data: {
          paymentId,
          idempotencyKeyHash: reconciliationHash,
          createdById: actorUserId
        }
      });

      for (const allocation of input.allocations) {
        const charge = chargeById.get(allocation.chargeId);

        if (!charge) {
          throw this.notFound('FINANCIAL_CHARGE_NOT_FOUND', 'Cobrança não encontrada.');
        }

        const allocationAmount = asDecimal(allocation.amount);
        await database.paymentAllocation.create({
          data: {
            reconciliationId: reconciliation.id,
            paymentId,
            chargeId: charge.id,
            amount: allocationAmount,
            createdById: actorUserId
          }
        });
        const totalAllocated = charge.allocations
          .reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0))
          .add(allocationAmount);
        const status = determineChargeSettlement(
          money(charge.originalAmount),
          money(totalAllocated)
        );

        await database.financialCharge.update({
          where: { id: charge.id },
          data: { status }
        });
      }

      const surplusAmount = new Prisma.Decimal(outcome.surplusAmount);

      if (surplusAmount.gt(0) && outcome.disposition) {
        await database.paymentSurplus.create({
          data: {
            paymentId,
            amount: surplusAmount,
            currency: 'BRL',
            disposition: outcome.disposition
          }
        });

        if (outcome.disposition === FinancialSurplusDisposition.CREDIT) {
          await database.paymentCredit.create({
            data: {
              sourcePaymentId: paymentId,
              originalAmount: surplusAmount,
              remainingAmount: surplusAmount,
              currency: 'BRL',
              status: PaymentCreditStatus.OPEN
            }
          });
        }
      }

      const openCash = await database.cashSession.findFirst({
        where: { accountId: payment.accountId, status: CashSessionStatus.OPEN }
      });
      await database.financialTransaction.create({
        data: {
          accountId: payment.accountId,
          categoryId: input.incomeCategoryId,
          paymentId,
          cashSessionId: openCash?.id ?? null,
          type: FinancialTransactionType.INCOME,
          status: FinancialTransactionStatus.APPROVED,
          amount: payment.amount,
          currency: 'BRL',
          description: 'Recebimento conciliado',
          occurredAt: payment.paidAt,
          idempotencyKeyHash: derivedIdempotencyHash(idempotencyKey, 'payment-ledger'),
          createdById: actorUserId,
          approvedById: actorUserId,
          approvedAt: new Date()
        }
      });
      await database.financialPayment.update({
        where: { id: paymentId },
        data: {
          status: FinancialPaymentStatus.APPROVED,
          approvedById: actorUserId,
          approvedAt: new Date()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financePaymentReconciled,
          actorUserId,
          entityType: 'FinancialPayment',
          entityId: paymentId,
          afterData: {
            status: FinancialPaymentStatus.APPROVED,
            allocationCount: input.allocations.length,
            hasSurplus: surplusAmount.gt(0),
            surplusDisposition: outcome.disposition
          },
          reason: input.reason.trim(),
          request
        },
        database
      );
    });

    return this.getMappedPayment(paymentId);
  }

  public async listTransactions(query: FinanceQueryDto) {
    const records = await this.prisma.financialTransaction.findMany({
      include: {
        account: true,
        category: true,
        costCenter: true,
        reversal: true,
        reversalOf: true
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (transaction) => this.mapTransaction(transaction));
  }

  public async createPendingTransaction(
    input: CreatePendingFinancialTransactionDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const keyHash = idempotencyHash(idempotencyKey);
    const existing = await this.prisma.financialTransaction.findUnique({
      where: { idempotencyKeyHash: keyHash },
      include: {
        account: true,
        category: true,
        costCenter: true,
        reversal: true,
        reversalOf: true
      }
    });

    if (existing) {
      this.ensureTransactionIdempotency(existing, input);

      return this.mapTransaction(existing);
    }

    await this.validatePendingTransactionReferences(input);

    try {
      const transactionId = await this.prisma.$transaction(async (database) => {
        const transaction = await database.financialTransaction.create({
          data: {
            accountId: input.accountId,
            categoryId: input.categoryId ?? null,
            costCenterId: input.costCenterId ?? null,
            obligationId: input.obligationId ?? null,
            cashSessionId: input.cashSessionId ?? null,
            type: input.type,
            status: FinancialTransactionStatus.PENDING,
            amount: asDecimal(input.amount),
            currency: 'BRL',
            description: input.description.trim(),
            occurredAt: new Date(input.occurredAt),
            idempotencyKeyHash: keyHash,
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeTransactionCreated,
            actorUserId,
            entityType: 'FinancialTransaction',
            entityId: transaction.id,
            afterData: {
              type: transaction.type,
              status: transaction.status,
              accountId: transaction.accountId,
              currency: transaction.currency
            },
            request
          },
          database
        );

        return transaction.id;
      });

      return this.getMappedTransaction(transactionId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.prisma.financialTransaction.findUnique({
          where: { idempotencyKeyHash: keyHash },
          include: {
            account: true,
            category: true,
            costCenter: true,
            reversal: true,
            reversalOf: true
          }
        });

        if (raced) {
          this.ensureTransactionIdempotency(raced, input);

          return this.mapTransaction(raced);
        }

        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async approveTransaction(
    transactionId: string,
    input: FinancialDecisionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      const transaction = await this.lockTransaction(database, transactionId);

      if (transaction.status !== FinancialTransactionStatus.PENDING) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSACTION_NOT_PENDING',
          message: 'Somente lançamento pendente pode ser aprovado.'
        });
      }

      await database.financialTransaction.update({
        where: { id: transactionId },
        data: {
          status: FinancialTransactionStatus.APPROVED,
          approvedById: actorUserId,
          approvedAt: new Date()
        }
      });
      if (transaction.obligationId) {
        await this.refreshObligationStatus(database, transaction.obligationId);
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransactionApproved,
          actorUserId,
          entityType: 'FinancialTransaction',
          entityId: transactionId,
          reason: input.reason.trim(),
          beforeData: { status: transaction.status },
          afterData: { status: FinancialTransactionStatus.APPROVED },
          request
        },
        database
      );
    });

    return this.getMappedTransaction(transactionId);
  }

  public async rejectTransaction(
    transactionId: string,
    input: FinancialDecisionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      const transaction = await this.lockTransaction(database, transactionId);

      if (transaction.status !== FinancialTransactionStatus.PENDING) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSACTION_NOT_PENDING',
          message: 'Somente lançamento pendente pode ser rejeitado.'
        });
      }

      await database.financialTransaction.update({
        where: { id: transactionId },
        data: {
          status: FinancialTransactionStatus.REJECTED,
          rejectedById: actorUserId,
          rejectedAt: new Date(),
          rejectionReason: input.reason.trim()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransactionRejected,
          actorUserId,
          entityType: 'FinancialTransaction',
          entityId: transactionId,
          reason: input.reason.trim(),
          beforeData: { status: transaction.status },
          afterData: { status: FinancialTransactionStatus.REJECTED },
          request
        },
        database
      );
    });

    return this.getMappedTransaction(transactionId);
  }

  public async reverseTransaction(
    transactionId: string,
    input: FinancialDecisionDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const reversalKeyHash = idempotencyHash(idempotencyKey);
    let reversalId = '';

    await this.withSerializableRetry(async (database) => {
      const transaction = await this.lockTransaction(database, transactionId);
      const existingByKey = await database.financialTransaction.findUnique({
        where: { idempotencyKeyHash: reversalKeyHash }
      });

      if (existingByKey) {
        if (existingByKey.reversalOfId !== transactionId) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
            message: 'A chave de idempotência já foi usada em outra operação.'
          });
        }

        reversalId = existingByKey.id;
        return;
      }

      if (transaction.status !== FinancialTransactionStatus.APPROVED) {
        if (
          transaction.status === FinancialTransactionStatus.REVERSED &&
          transaction.reversal?.id
        ) {
          reversalId = transaction.reversal.id;
          return;
        }

        throw new ConflictException({
          code: 'FINANCIAL_TRANSACTION_NOT_REVERSIBLE',
          message: 'Somente movimentação aprovada e ainda não revertida pode ser corrigida.'
        });
      }

      if (transaction.paymentId || transaction.transferId) {
        throw new ConflictException({
          code: 'FINANCIAL_SOURCE_REVERSAL_REQUIRES_SPECIFIC_WORKFLOW',
          message:
            'Pagamentos e transferências exigem o fluxo de reversão específico para preservar a conciliação.'
        });
      }

      const reversal = await database.financialTransaction.create({
        data: {
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          costCenterId: transaction.costCenterId,
          paymentId: transaction.paymentId,
          transferId: transaction.transferId,
          obligationId: transaction.obligationId,
          cashSessionId: transaction.cashSessionId,
          reversalOfId: transaction.id,
          type: FinancialTransactionType.REVERSAL,
          status: FinancialTransactionStatus.APPROVED,
          amount: transaction.amount,
          currency: transaction.currency,
          description: `Reversão: ${transaction.description}`.slice(0, 220),
          occurredAt: new Date(),
          idempotencyKeyHash: reversalKeyHash,
          createdById: actorUserId,
          approvedById: actorUserId,
          approvedAt: new Date()
        }
      });
      await database.financialTransaction.update({
        where: { id: transactionId },
        data: {
          status: FinancialTransactionStatus.REVERSED,
          reversedById: actorUserId,
          reversedAt: new Date(),
          reversalReason: input.reason.trim()
        }
      });
      if (transaction.obligationId) {
        await this.refreshObligationStatus(database, transaction.obligationId);
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransactionReversed,
          actorUserId,
          entityType: 'FinancialTransaction',
          entityId: transactionId,
          reason: input.reason.trim(),
          beforeData: { status: FinancialTransactionStatus.APPROVED },
          afterData: {
            status: FinancialTransactionStatus.REVERSED,
            reversalTransactionId: reversal.id
          },
          request
        },
        database
      );
      reversalId = reversal.id;
    });

    return {
      original: await this.getMappedTransaction(transactionId),
      reversal: await this.getMappedTransaction(reversalId)
    };
  }

  public async listTransfers(query: FinanceQueryDto) {
    const records = await this.prisma.financialTransfer.findMany({
      include: { sourceAccount: true, targetAccount: true, transactions: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (transfer) => this.mapTransfer(transfer));
  }

  public async createTransfer(
    input: CreateFinancialTransferDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    if (input.sourceAccountId === input.targetAccountId) {
      throw new ConflictException({
        code: 'FINANCIAL_TRANSFER_SAME_ACCOUNT',
        message: 'A transferência exige contas de origem e destino distintas.'
      });
    }

    const [source, target] = await Promise.all([
      this.findAccount(input.sourceAccountId),
      this.findAccount(input.targetAccountId)
    ]);

    if (source.currency !== target.currency) {
      throw new ConflictException({
        code: 'FINANCIAL_TRANSFER_CURRENCY_MISMATCH',
        message: 'As contas da transferência devem usar a mesma moeda.'
      });
    }

    const keyHash = idempotencyHash(idempotencyKey);
    const existing = await this.prisma.financialTransfer.findUnique({
      where: { idempotencyKeyHash: keyHash },
      include: { sourceAccount: true, targetAccount: true, transactions: true }
    });

    if (existing) {
      this.ensureTransferIdempotency(existing, input);

      return this.mapTransfer(existing);
    }

    try {
      const transferId = await this.prisma.$transaction(async (database) => {
        const transfer = await database.financialTransfer.create({
          data: {
            sourceAccountId: source.id,
            targetAccountId: target.id,
            amount: asDecimal(input.amount),
            currency: 'BRL',
            description: input.description.trim(),
            occurredAt: new Date(input.occurredAt),
            idempotencyKeyHash: keyHash,
            initiatedById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeTransferCreated,
            actorUserId,
            entityType: 'FinancialTransfer',
            entityId: transfer.id,
            afterData: {
              sourceAccountId: source.id,
              targetAccountId: target.id,
              status: transfer.status,
              currency: transfer.currency
            },
            request
          },
          database
        );

        return transfer.id;
      });

      return this.getMappedTransfer(transferId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.prisma.financialTransfer.findUnique({
          where: { idempotencyKeyHash: keyHash },
          include: { sourceAccount: true, targetAccount: true, transactions: true }
        });

        if (raced) {
          this.ensureTransferIdempotency(raced, input);

          return this.mapTransfer(raced);
        }
      }

      throw error;
    }
  }

  public async approveTransfer(
    transferId: string,
    input: FinancialDecisionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      const transfer = await this.lockTransfer(database, transferId);

      if (transfer.status !== FinancialTransferStatus.PENDING) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSFER_NOT_PENDING',
          message: 'Somente transferência pendente pode ser aprovada.'
        });
      }

      const [sourceCash, targetCash] = await Promise.all([
        database.cashSession.findFirst({
          where: { accountId: transfer.sourceAccountId, status: CashSessionStatus.OPEN }
        }),
        database.cashSession.findFirst({
          where: { accountId: transfer.targetAccountId, status: CashSessionStatus.OPEN }
        })
      ]);
      await database.financialTransaction.createMany({
        data: [
          {
            accountId: transfer.sourceAccountId,
            transferId,
            cashSessionId: sourceCash?.id ?? null,
            type: FinancialTransactionType.TRANSFER_OUT,
            status: FinancialTransactionStatus.APPROVED,
            amount: transfer.amount,
            currency: transfer.currency,
            description: transfer.description,
            occurredAt: transfer.occurredAt,
            idempotencyKeyHash: derivedIdempotencyHash(transfer.idempotencyKeyHash, 'transfer-out'),
            createdById: transfer.initiatedById,
            approvedById: actorUserId,
            approvedAt: new Date()
          },
          {
            accountId: transfer.targetAccountId,
            transferId,
            cashSessionId: targetCash?.id ?? null,
            type: FinancialTransactionType.TRANSFER_IN,
            status: FinancialTransactionStatus.APPROVED,
            amount: transfer.amount,
            currency: transfer.currency,
            description: transfer.description,
            occurredAt: transfer.occurredAt,
            idempotencyKeyHash: derivedIdempotencyHash(transfer.idempotencyKeyHash, 'transfer-in'),
            createdById: transfer.initiatedById,
            approvedById: actorUserId,
            approvedAt: new Date()
          }
        ]
      });
      await database.financialTransfer.update({
        where: { id: transferId },
        data: {
          status: FinancialTransferStatus.APPROVED,
          approvedById: actorUserId,
          approvedAt: new Date()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransferApproved,
          actorUserId,
          entityType: 'FinancialTransfer',
          entityId: transferId,
          reason: input.reason.trim(),
          beforeData: { status: transfer.status },
          afterData: { status: FinancialTransferStatus.APPROVED, ledgerRows: 2 },
          request
        },
        database
      );
    });

    return this.getMappedTransfer(transferId);
  }

  public async rejectTransfer(
    transferId: string,
    input: FinancialDecisionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      const transfer = await this.lockTransfer(database, transferId);

      if (transfer.status !== FinancialTransferStatus.PENDING) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSFER_NOT_PENDING',
          message: 'Somente transferência pendente pode ser rejeitada.'
        });
      }

      await database.financialTransfer.update({
        where: { id: transferId },
        data: {
          status: FinancialTransferStatus.REJECTED,
          rejectedById: actorUserId,
          rejectedAt: new Date(),
          rejectionReason: input.reason.trim()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransferRejected,
          actorUserId,
          entityType: 'FinancialTransfer',
          entityId: transferId,
          reason: input.reason.trim(),
          beforeData: { status: transfer.status },
          afterData: { status: FinancialTransferStatus.REJECTED },
          request
        },
        database
      );
    });

    return this.getMappedTransfer(transferId);
  }

  public async reverseTransfer(
    transferId: string,
    input: FinancialDecisionDto,
    idempotencyKey: string,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      const transfer = await this.lockTransfer(database, transferId);

      if (transfer.status === FinancialTransferStatus.REVERSED) {
        return;
      }

      if (transfer.status !== FinancialTransferStatus.APPROVED) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSFER_NOT_REVERSIBLE',
          message: 'Somente transferência aprovada pode ser revertida.'
        });
      }

      const legs = await database.financialTransaction.findMany({
        where: {
          transferId,
          status: FinancialTransactionStatus.APPROVED,
          type: {
            in: [FinancialTransactionType.TRANSFER_IN, FinancialTransactionType.TRANSFER_OUT]
          }
        },
        orderBy: { type: 'asc' }
      });

      if (legs.length !== 2) {
        throw new ConflictException({
          code: 'FINANCIAL_TRANSFER_LEDGER_INCONSISTENT',
          message: 'A transferência não possui o par contábil esperado.'
        });
      }

      for (const leg of legs) {
        const legKey = derivedIdempotencyHash(idempotencyKey, `transfer-reversal-${leg.id}`);
        await database.financialTransaction.create({
          data: {
            accountId: leg.accountId,
            transferId,
            cashSessionId: leg.cashSessionId,
            reversalOfId: leg.id,
            type: FinancialTransactionType.REVERSAL,
            status: FinancialTransactionStatus.APPROVED,
            amount: leg.amount,
            currency: leg.currency,
            description: `Reversão: ${leg.description}`.slice(0, 220),
            occurredAt: new Date(),
            idempotencyKeyHash: legKey,
            createdById: actorUserId,
            approvedById: actorUserId,
            approvedAt: new Date()
          }
        });
        await database.financialTransaction.update({
          where: { id: leg.id },
          data: {
            status: FinancialTransactionStatus.REVERSED,
            reversedById: actorUserId,
            reversedAt: new Date(),
            reversalReason: input.reason.trim()
          }
        });
      }

      await database.financialTransfer.update({
        where: { id: transferId },
        data: {
          status: FinancialTransferStatus.REVERSED,
          reversedById: actorUserId,
          reversedAt: new Date(),
          reversalReason: input.reason.trim()
        }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeTransferReversed,
          actorUserId,
          entityType: 'FinancialTransfer',
          entityId: transferId,
          reason: input.reason.trim(),
          beforeData: { status: FinancialTransferStatus.APPROVED },
          afterData: { status: FinancialTransferStatus.REVERSED, reversalRows: 2 },
          request
        },
        database
      );
    });

    return this.getMappedTransfer(transferId);
  }

  public async listObligations(query: FinanceQueryDto) {
    const records = await this.prisma.financialObligation.findMany({
      include: { account: true, category: true, costCenter: true, transactions: true },
      orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (obligation) => ({
      id: obligation.id,
      type: obligation.type,
      status: obligation.status,
      referenceCode: obligation.referenceCode,
      description: obligation.description,
      dueDate: civilDate(obligation.dueDate),
      amount: money(obligation.amount),
      currency: obligation.currency,
      category: {
        id: obligation.category.id,
        name: obligation.category.name,
        type: obligation.category.type
      },
      costCenter: obligation.costCenter
        ? { id: obligation.costCenter.id, name: obligation.costCenter.name }
        : null,
      account: obligation.account
        ? { id: obligation.account.id, name: obligation.account.name }
        : null,
      approvedSettlementAmount: money(
        obligation.transactions
          .filter(
            ({ status, type }) =>
              status === FinancialTransactionStatus.APPROVED &&
              type !== FinancialTransactionType.REVERSAL
          )
          .reduce((total, transaction) => total.add(transaction.amount), new Prisma.Decimal(0))
      )
    }));
  }

  public async createObligation(
    input: CreateFinancialObligationDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const category = await this.findCategory(input.categoryId);
    const expectedCategory =
      input.type === FinancialObligationType.PAYABLE
        ? FinancialCategoryType.EXPENSE
        : FinancialCategoryType.INCOME;

    if (category.type !== expectedCategory) {
      throw new ConflictException({
        code: 'FINANCIAL_OBLIGATION_CATEGORY_MISMATCH',
        message: 'A categoria não corresponde ao tipo da obrigação.'
      });
    }

    await Promise.all([
      input.costCenterId ? this.findCostCenter(input.costCenterId) : Promise.resolve(),
      input.accountId ? this.findAccount(input.accountId) : Promise.resolve()
    ]);

    try {
      const obligationId = await this.prisma.$transaction(async (database) => {
        const obligation = await database.financialObligation.create({
          data: {
            type: input.type,
            status: FinancialObligationStatus.OPEN,
            categoryId: category.id,
            costCenterId: input.costCenterId ?? null,
            accountId: input.accountId ?? null,
            referenceCode: input.referenceCode.trim().toLocaleUpperCase('pt-BR'),
            description: input.description.trim(),
            counterpartyRef: input.counterpartyReference?.trim() ?? null,
            dueDate: toCivilDate(input.dueDate),
            amount: asDecimal(input.amount),
            currency: 'BRL',
            createdById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeObligationCreated,
            actorUserId,
            entityType: 'FinancialObligation',
            entityId: obligation.id,
            afterData: {
              type: obligation.type,
              status: obligation.status,
              referenceCode: obligation.referenceCode,
              currency: obligation.currency
            },
            request
          },
          database
        );

        return obligation.id;
      });

      return (await this.listObligations({ limit: 100 })).data.find(
        ({ id }) => id === obligationId
      );
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw duplicateConflict();
      }

      throw error;
    }
  }

  public async listCashSessions(query: FinanceQueryDto) {
    const records = await this.prisma.cashSession.findMany({
      include: { account: true, closing: true, transactions: true },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    return this.page(records, query.limit, (session) => this.mapCashSession(session));
  }

  public async openCashSession(
    input: OpenCashSessionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    const account = await this.findAccount(input.accountId);

    if (account.type !== FinancialAccountType.CASH) {
      throw new ConflictException({
        code: 'CASH_SESSION_REQUIRES_CASH_ACCOUNT',
        message: 'Uma sessão do Caixa Fênix exige conta do tipo caixa.'
      });
    }

    try {
      const sessionId = await this.prisma.$transaction(async (database) => {
        const session = await database.cashSession.create({
          data: {
            accountId: account.id,
            openingBalance: asNonnegativeDecimal(input.openingBalance),
            status: CashSessionStatus.OPEN,
            openedById: actorUserId
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.financeCashOpened,
            actorUserId,
            entityType: 'CashSession',
            entityId: session.id,
            afterData: {
              accountId: session.accountId,
              status: session.status,
              currency: account.currency
            },
            request
          },
          database
        );

        return session.id;
      });

      return this.getMappedCashSession(sessionId);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException({
          code: 'CASH_SESSION_ALREADY_OPEN',
          message: 'A conta já possui uma sessão de caixa aberta.'
        });
      }

      throw error;
    }
  }

  public async closeCashSession(
    cashSessionId: string,
    input: CloseCashSessionDto,
    actorUserId: string,
    request: RequestWithPrincipal
  ) {
    await this.withSerializableRetry(async (database) => {
      await database.$queryRaw`
        SELECT "id" FROM "cash_sessions" WHERE "id" = ${cashSessionId}::uuid FOR UPDATE
      `;
      const session = await database.cashSession.findUnique({
        where: { id: cashSessionId },
        include: {
          closing: true,
          transactions: {
            where: {
              status: {
                in: [FinancialTransactionStatus.APPROVED, FinancialTransactionStatus.REVERSED]
              }
            },
            include: { category: true, reversalOf: { include: { category: true } } }
          }
        }
      });

      if (!session) {
        throw this.notFound('CASH_SESSION_NOT_FOUND', 'Sessão de caixa não encontrada.');
      }

      if (session.closing) {
        return;
      }

      if (session.status !== CashSessionStatus.OPEN) {
        throw new ConflictException({
          code: 'CASH_SESSION_NOT_OPEN',
          message: 'Somente sessão aberta pode ser fechada.'
        });
      }

      let inflows = new Prisma.Decimal(0);
      let outflows = new Prisma.Decimal(0);
      let adjustments = new Prisma.Decimal(0);

      for (const transaction of session.transactions) {
        const effect = this.transactionEffect(transaction);
        const isAdjustment =
          transaction.type === FinancialTransactionType.ADJUSTMENT ||
          transaction.type === FinancialTransactionType.REVERSAL;

        if (isAdjustment) {
          adjustments = adjustments.add(effect);
        } else if (effect.gte(0)) {
          inflows = inflows.add(effect);
        } else {
          outflows = outflows.add(effect.abs());
        }
      }

      const closingCalculation = calculateCashClosing({
        openingBalance: money(session.openingBalance),
        inflows: money(inflows),
        outflows: money(outflows),
        adjustments: money(adjustments),
        countedFinalBalance: input.countedFinalBalance
      });
      const expected = new Prisma.Decimal(closingCalculation.expectedFinalBalance);
      const difference = new Prisma.Decimal(closingCalculation.differenceAmount);

      await database.cashClosing.create({
        data: {
          cashSessionId,
          openingBalance: session.openingBalance,
          inflows,
          outflows,
          adjustments,
          expectedFinalBalance: expected,
          countedFinalBalance: asNonnegativeDecimal(input.countedFinalBalance),
          differenceAmount: difference,
          reason: input.reason?.trim() ?? null,
          closedById: actorUserId
        }
      });
      await database.cashSession.update({
        where: { id: cashSessionId },
        data: { status: CashSessionStatus.CLOSED, closedAt: new Date() }
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.financeCashClosed,
          actorUserId,
          entityType: 'CashSession',
          entityId: cashSessionId,
          ...(input.reason ? { reason: input.reason.trim() } : {}),
          beforeData: { status: CashSessionStatus.OPEN },
          afterData: {
            status: CashSessionStatus.CLOSED,
            transactionCount: session.transactions.length,
            hasDifference: !difference.isZero()
          },
          request
        },
        database
      );
    });

    return this.getMappedCashSession(cashSessionId);
  }

  private async validatePendingTransactionReferences(
    input: CreatePendingFinancialTransactionDto
  ): Promise<void> {
    const [account, category, costCenter, obligation, cashSession] = await Promise.all([
      this.findAccount(input.accountId),
      input.categoryId ? this.findCategory(input.categoryId) : Promise.resolve(undefined),
      input.costCenterId ? this.findCostCenter(input.costCenterId) : Promise.resolve(undefined),
      input.obligationId
        ? this.prisma.financialObligation.findUnique({ where: { id: input.obligationId } })
        : Promise.resolve(undefined),
      input.cashSessionId
        ? this.prisma.cashSession.findUnique({ where: { id: input.cashSessionId } })
        : Promise.resolve(undefined)
    ]);
    const expectedCategory =
      input.type === FinancialTransactionType.INCOME
        ? FinancialCategoryType.INCOME
        : input.type === FinancialTransactionType.EXPENSE
          ? FinancialCategoryType.EXPENSE
          : undefined;

    if (!category) {
      throw new ConflictException({
        code: 'FINANCIAL_TRANSACTION_CATEGORY_REQUIRED',
        message: 'Lançamento financeiro exige categoria.'
      });
    }

    if (expectedCategory && category.type !== expectedCategory) {
      throw new ConflictException({
        code: 'FINANCIAL_TRANSACTION_CATEGORY_MISMATCH',
        message: 'A categoria não corresponde ao tipo do lançamento.'
      });
    }

    if (input.obligationId && !obligation) {
      throw this.notFound('FINANCIAL_OBLIGATION_NOT_FOUND', 'Obrigação financeira não encontrada.');
    }

    if (
      obligation &&
      ((obligation.type === FinancialObligationType.PAYABLE &&
        input.type !== FinancialTransactionType.EXPENSE) ||
        (obligation.type === FinancialObligationType.RECEIVABLE &&
          input.type !== FinancialTransactionType.INCOME))
    ) {
      throw new ConflictException({
        code: 'FINANCIAL_OBLIGATION_TRANSACTION_MISMATCH',
        message: 'O lançamento não corresponde ao tipo da obrigação.'
      });
    }

    if (
      input.cashSessionId &&
      (!cashSession ||
        cashSession.status !== CashSessionStatus.OPEN ||
        cashSession.accountId !== account.id)
    ) {
      throw new ConflictException({
        code: 'CASH_SESSION_TRANSACTION_MISMATCH',
        message: 'A sessão de caixa deve estar aberta e pertencer à conta do lançamento.'
      });
    }

    void costCenter;
  }

  private async refreshObligationStatus(
    database: Prisma.TransactionClient,
    obligationId: string
  ): Promise<void> {
    const obligation = await database.financialObligation.findUnique({
      where: { id: obligationId },
      include: {
        transactions: {
          where: {
            status: FinancialTransactionStatus.APPROVED,
            type: { in: [FinancialTransactionType.INCOME, FinancialTransactionType.EXPENSE] }
          }
        }
      }
    });

    if (!obligation || obligation.status === FinancialObligationStatus.CANCELLED) {
      return;
    }

    const settled = obligation.transactions.reduce(
      (total, transaction) => total.add(transaction.amount),
      new Prisma.Decimal(0)
    );
    const status = settled.isZero()
      ? FinancialObligationStatus.OPEN
      : settled.gte(obligation.amount)
        ? FinancialObligationStatus.SETTLED
        : FinancialObligationStatus.PARTIALLY_SETTLED;

    await database.financialObligation.update({
      where: { id: obligationId },
      data: { status }
    });
  }

  private async lockTransaction(database: Prisma.TransactionClient, transactionId: string) {
    await database.$queryRaw`
      SELECT "id" FROM "financial_transactions" WHERE "id" = ${transactionId}::uuid FOR UPDATE
    `;
    const transaction = await database.financialTransaction.findUnique({
      where: { id: transactionId },
      include: { reversal: true }
    });

    if (!transaction) {
      throw this.notFound(
        'FINANCIAL_TRANSACTION_NOT_FOUND',
        'Movimentação financeira não encontrada.'
      );
    }

    return transaction;
  }

  private async lockTransfer(database: Prisma.TransactionClient, transferId: string) {
    await database.$queryRaw`
      SELECT "id" FROM "financial_transfers" WHERE "id" = ${transferId}::uuid FOR UPDATE
    `;
    const transfer = await database.financialTransfer.findUnique({ where: { id: transferId } });

    if (!transfer) {
      throw this.notFound('FINANCIAL_TRANSFER_NOT_FOUND', 'Transferência não encontrada.');
    }

    return transfer;
  }

  private async findAccount(accountId: string) {
    const account = await this.prisma.financialAccount.findUnique({ where: { id: accountId } });

    if (!account || account.deletedAt || !account.isActive) {
      throw this.notFound('FINANCIAL_ACCOUNT_NOT_FOUND', 'Conta financeira não encontrada.');
    }

    return account;
  }

  private async findCategory(categoryId: string) {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category || category.deletedAt || !category.isActive) {
      throw this.notFound('FINANCIAL_CATEGORY_NOT_FOUND', 'Categoria financeira não encontrada.');
    }

    return category;
  }

  private async findCostCenter(costCenterId: string) {
    const center = await this.prisma.costCenter.findUnique({ where: { id: costCenterId } });

    if (!center || center.deletedAt || !center.isActive) {
      throw this.notFound('COST_CENTER_NOT_FOUND', 'Centro de custo não encontrado.');
    }

    return center;
  }

  private ensureChargeIdempotency(
    charge: {
      readonly referenceCode: string;
      readonly planVersionId: string | null;
      readonly description: string;
      readonly competence: Date;
      readonly dueDate: Date;
      readonly originalAmount: Prisma.Decimal;
    },
    input: CreateFinancialChargeDto
  ): void {
    if (
      charge.referenceCode !== input.referenceCode.trim().toLocaleUpperCase('pt-BR') ||
      charge.planVersionId !== (input.planVersionId ?? null) ||
      charge.description !== input.description.trim() ||
      civilDate(charge.competence) !== input.competence ||
      civilDate(charge.dueDate) !== input.dueDate ||
      !charge.originalAmount.equals(asDecimal(input.amount))
    ) {
      throw this.idempotencyConflict();
    }
  }

  private ensurePaymentIdempotency(
    payment: {
      readonly accountId: string;
      readonly privateAttachmentId: string | null;
      readonly externalReference: string | null;
      readonly amount: Prisma.Decimal;
      readonly paidAt: Date;
    },
    input: CreateFinancialPaymentDto
  ): void {
    if (
      payment.accountId !== input.accountId ||
      payment.privateAttachmentId !== (input.privateAttachmentId ?? null) ||
      payment.externalReference !== (input.externalReference?.trim() ?? null) ||
      !payment.amount.equals(asDecimal(input.amount)) ||
      payment.paidAt.toISOString() !== new Date(input.paidAt).toISOString()
    ) {
      throw this.idempotencyConflict();
    }
  }

  private ensureReconciliationIdempotency(
    storedReconciliation: {
      readonly allocations: readonly {
        readonly chargeId: string;
        readonly amount: Prisma.Decimal;
      }[];
      readonly categoryId: string | null;
      readonly surplusDisposition: FinancialSurplusDisposition | null;
    },
    input: ReconcileFinancialPaymentDto
  ): void {
    const stored = storedReconciliation.allocations
      .map(({ chargeId, amount }) => `${chargeId}:${money(amount)}`)
      .sort()
      .join('|');
    const received = input.allocations
      .map(({ chargeId, amount }) => `${chargeId}:${money(asDecimal(amount))}`)
      .sort()
      .join('|');

    if (
      stored !== received ||
      storedReconciliation.categoryId !== input.incomeCategoryId ||
      storedReconciliation.surplusDisposition !== (input.surplusDisposition ?? null)
    ) {
      throw this.idempotencyConflict();
    }
  }

  private ensureTransactionIdempotency(
    transaction: {
      readonly accountId: string;
      readonly categoryId: string | null;
      readonly costCenterId: string | null;
      readonly obligationId: string | null;
      readonly cashSessionId: string | null;
      readonly type: FinancialTransactionType;
      readonly amount: Prisma.Decimal;
      readonly description: string;
      readonly occurredAt: Date;
    },
    input: CreatePendingFinancialTransactionDto
  ): void {
    if (
      transaction.accountId !== input.accountId ||
      transaction.categoryId !== (input.categoryId ?? null) ||
      transaction.costCenterId !== (input.costCenterId ?? null) ||
      transaction.obligationId !== (input.obligationId ?? null) ||
      transaction.cashSessionId !== (input.cashSessionId ?? null) ||
      transaction.type !== input.type ||
      !transaction.amount.equals(asDecimal(input.amount)) ||
      transaction.description !== input.description.trim() ||
      transaction.occurredAt.toISOString() !== new Date(input.occurredAt).toISOString()
    ) {
      throw this.idempotencyConflict();
    }
  }

  private ensureTransferIdempotency(
    transfer: {
      readonly sourceAccountId: string;
      readonly targetAccountId: string;
      readonly amount: Prisma.Decimal;
      readonly description: string;
      readonly occurredAt: Date;
    },
    input: CreateFinancialTransferDto
  ): void {
    if (
      transfer.sourceAccountId !== input.sourceAccountId ||
      transfer.targetAccountId !== input.targetAccountId ||
      !transfer.amount.equals(asDecimal(input.amount)) ||
      transfer.description !== input.description.trim() ||
      transfer.occurredAt.toISOString() !== new Date(input.occurredAt).toISOString()
    ) {
      throw this.idempotencyConflict();
    }
  }

  private idempotencyConflict(): ConflictException {
    return new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
      message: 'A chave de idempotência já foi usada com conteúdo diferente.'
    });
  }

  private async getMappedCharge(chargeId: string) {
    const charge = await this.prisma.financialCharge.findUniqueOrThrow({
      where: { id: chargeId },
      include: { allocations: true, planVersion: { include: { plan: true } } }
    });

    return this.mapCharge(charge);
  }

  private mapCharge(charge: {
    readonly id: string;
    readonly referenceCode: string;
    readonly description: string;
    readonly competence: Date;
    readonly dueDate: Date;
    readonly originalAmount: Prisma.Decimal;
    readonly currency: string;
    readonly status: FinancialChargeStatus;
    readonly createdAt: Date;
    readonly allocations: readonly { readonly amount: Prisma.Decimal }[];
    readonly planVersion: {
      readonly id: string;
      readonly version: number;
      readonly plan: { readonly id: string; readonly name: string };
    } | null;
  }) {
    const allocated = charge.allocations.reduce(
      (total, allocation) => total.add(allocation.amount),
      new Prisma.Decimal(0)
    );

    return {
      id: charge.id,
      referenceCode: charge.referenceCode,
      description: charge.description,
      competence: civilDate(charge.competence),
      dueDate: civilDate(charge.dueDate),
      originalAmount: money(charge.originalAmount),
      allocatedAmount: money(allocated),
      outstandingAmount: money(Prisma.Decimal.max(charge.originalAmount.sub(allocated), 0)),
      currency: charge.currency,
      status: charge.status,
      planVersion: charge.planVersion
        ? {
            id: charge.planVersion.id,
            version: charge.planVersion.version,
            plan: charge.planVersion.plan
          }
        : null,
      createdAt: charge.createdAt.toISOString()
    };
  }

  private async findPaymentByIdempotency(keyHash: string) {
    return this.prisma.financialPayment.findUnique({
      where: { idempotencyKeyHash: keyHash },
      include: {
        account: true,
        allocations: { include: { charge: true } },
        credit: true,
        reconciliation: true,
        surplus: true
      }
    });
  }

  private async getMappedPayment(paymentId: string) {
    const payment = await this.prisma.financialPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        account: true,
        allocations: { include: { charge: true } },
        credit: true,
        reconciliation: true,
        surplus: true
      }
    });

    return this.mapPayment(payment);
  }

  private mapPayment(payment: {
    readonly id: string;
    readonly accountId: string;
    readonly privateAttachmentId: string | null;
    readonly externalReference: string | null;
    readonly amount: Prisma.Decimal;
    readonly currency: string;
    readonly paidAt: Date;
    readonly status: FinancialPaymentStatus;
    readonly approvedAt: Date | null;
    readonly createdAt: Date;
    readonly account: { readonly id: string; readonly name: string };
    readonly reconciliation: { readonly id: string } | null;
    readonly allocations: readonly {
      readonly id: string;
      readonly amount: Prisma.Decimal;
      readonly charge: { readonly id: string; readonly referenceCode: string };
    }[];
    readonly surplus: {
      readonly amount: Prisma.Decimal;
      readonly disposition: FinancialSurplusDisposition;
    } | null;
    readonly credit: {
      readonly id: string;
      readonly remainingAmount: Prisma.Decimal;
      readonly status: PaymentCreditStatus;
    } | null;
  }) {
    return {
      id: payment.id,
      account: payment.account,
      amount: money(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt.toISOString(),
      status: payment.status,
      externalReference: payment.externalReference,
      hasPrivateReceipt: Boolean(payment.privateAttachmentId),
      reconciliationId: payment.reconciliation?.id ?? null,
      allocations: payment.allocations.map((allocation) => ({
        id: allocation.id,
        amount: money(allocation.amount),
        charge: allocation.charge
      })),
      surplus: payment.surplus
        ? {
            amount: money(payment.surplus.amount),
            disposition: payment.surplus.disposition
          }
        : null,
      credit: payment.credit
        ? {
            id: payment.credit.id,
            remainingAmount: money(payment.credit.remainingAmount),
            status: payment.credit.status
          }
        : null,
      approvedAt: payment.approvedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString()
    };
  }

  private async getMappedTransaction(transactionId: string) {
    const transaction = await this.prisma.financialTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: {
        account: true,
        category: true,
        costCenter: true,
        reversal: true,
        reversalOf: true
      }
    });

    return this.mapTransaction(transaction);
  }

  private mapTransaction(transaction: {
    readonly id: string;
    readonly type: FinancialTransactionType;
    readonly status: FinancialTransactionStatus;
    readonly amount: Prisma.Decimal;
    readonly currency: string;
    readonly description: string;
    readonly occurredAt: Date;
    readonly approvedAt: Date | null;
    readonly rejectionReason: string | null;
    readonly reversalReason: string | null;
    readonly account: { readonly id: string; readonly name: string };
    readonly category: { readonly id: string; readonly name: string } | null;
    readonly costCenter: { readonly id: string; readonly name: string } | null;
    readonly reversal: { readonly id: string } | null;
    readonly reversalOf: { readonly id: string } | null;
  }) {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: money(transaction.amount),
      currency: transaction.currency,
      description: transaction.description,
      occurredAt: transaction.occurredAt.toISOString(),
      account: transaction.account,
      category: transaction.category,
      costCenter: transaction.costCenter,
      approvedAt: transaction.approvedAt?.toISOString() ?? null,
      rejectionReason: transaction.rejectionReason,
      reversalReason: transaction.reversalReason,
      reversalId: transaction.reversal?.id ?? null,
      reversalOfId: transaction.reversalOf?.id ?? null
    };
  }

  private async getMappedTransfer(transferId: string) {
    const transfer = await this.prisma.financialTransfer.findUniqueOrThrow({
      where: { id: transferId },
      include: { sourceAccount: true, targetAccount: true, transactions: true }
    });

    return this.mapTransfer(transfer);
  }

  private mapTransfer(transfer: {
    readonly id: string;
    readonly amount: Prisma.Decimal;
    readonly currency: string;
    readonly description: string;
    readonly occurredAt: Date;
    readonly status: FinancialTransferStatus;
    readonly approvedAt: Date | null;
    readonly rejectionReason: string | null;
    readonly reversalReason: string | null;
    readonly sourceAccount: { readonly id: string; readonly name: string };
    readonly targetAccount: { readonly id: string; readonly name: string };
    readonly transactions: readonly { readonly id: string }[];
  }) {
    return {
      id: transfer.id,
      sourceAccount: transfer.sourceAccount,
      targetAccount: transfer.targetAccount,
      amount: money(transfer.amount),
      currency: transfer.currency,
      description: transfer.description,
      occurredAt: transfer.occurredAt.toISOString(),
      status: transfer.status,
      approvedAt: transfer.approvedAt?.toISOString() ?? null,
      rejectionReason: transfer.rejectionReason,
      reversalReason: transfer.reversalReason,
      ledgerRowCount: transfer.transactions.length
    };
  }

  private async getMappedCashSession(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUniqueOrThrow({
      where: { id: cashSessionId },
      include: { account: true, closing: true, transactions: true }
    });

    return this.mapCashSession(session);
  }

  private mapCashSession(session: {
    readonly id: string;
    readonly openingBalance: Prisma.Decimal;
    readonly status: CashSessionStatus;
    readonly openedAt: Date;
    readonly closedAt: Date | null;
    readonly account: { readonly id: string; readonly name: string; readonly currency: string };
    readonly transactions: readonly { readonly id: string }[];
    readonly closing: {
      readonly openingBalance: Prisma.Decimal;
      readonly inflows: Prisma.Decimal;
      readonly outflows: Prisma.Decimal;
      readonly adjustments: Prisma.Decimal;
      readonly expectedFinalBalance: Prisma.Decimal;
      readonly countedFinalBalance: Prisma.Decimal;
      readonly differenceAmount: Prisma.Decimal;
      readonly closedAt: Date;
    } | null;
  }) {
    return {
      id: session.id,
      account: session.account,
      openingBalance: money(session.openingBalance),
      status: session.status,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
      transactionCount: session.transactions.length,
      closing: session.closing
        ? {
            openingBalance: money(session.closing.openingBalance),
            inflows: money(session.closing.inflows),
            outflows: money(session.closing.outflows),
            adjustments: money(session.closing.adjustments),
            expectedFinalBalance: money(session.closing.expectedFinalBalance),
            countedFinalBalance: money(session.closing.countedFinalBalance),
            differenceAmount: money(session.closing.differenceAmount),
            closedAt: session.closing.closedAt.toISOString()
          }
        : null
    };
  }

  private transactionEffect(transaction: {
    readonly type: FinancialTransactionType;
    readonly amount: Prisma.Decimal;
    readonly category: { readonly type: FinancialCategoryType } | null;
    readonly reversalOf: {
      readonly type: FinancialTransactionType;
      readonly amount: Prisma.Decimal;
      readonly category: { readonly type: FinancialCategoryType } | null;
    } | null;
  }): Prisma.Decimal {
    if (transaction.type === FinancialTransactionType.REVERSAL && transaction.reversalOf) {
      return this.baseTransactionEffect(transaction.reversalOf).negated();
    }

    return this.baseTransactionEffect(transaction);
  }

  private baseTransactionEffect(transaction: {
    readonly type: FinancialTransactionType;
    readonly amount: Prisma.Decimal;
    readonly category: { readonly type: FinancialCategoryType } | null;
  }): Prisma.Decimal {
    if (
      transaction.type === FinancialTransactionType.INCOME ||
      transaction.type === FinancialTransactionType.TRANSFER_IN
    ) {
      return transaction.amount;
    }

    if (
      transaction.type === FinancialTransactionType.EXPENSE ||
      transaction.type === FinancialTransactionType.TRANSFER_OUT
    ) {
      return transaction.amount.negated();
    }

    if (transaction.type === FinancialTransactionType.ADJUSTMENT) {
      return transaction.category?.type === FinancialCategoryType.EXPENSE
        ? transaction.amount.negated()
        : transaction.amount;
    }

    return new Prisma.Decimal(0);
  }

  private page<T extends { readonly id: string }, U>(
    records: readonly T[],
    limit: number,
    mapRecord: (record: T) => U
  ) {
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;

    return {
      data: page.map(mapRecord),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null
    };
  }

  private async withSerializableRetry<T>(
    operation: (database: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (!isSerializationConflict(error)) {
          throw error;
        }

        if (attempt === MAX_SERIALIZABLE_ATTEMPTS) {
          throw new ConflictException({
            code: 'FINANCE_CONCURRENCY_CONFLICT',
            message: 'A operação concorrente não pôde ser concluída com segurança.'
          });
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, attempt * 10);
        });
      }
    }

    throw new ConflictException({
      code: 'FINANCE_CONCURRENCY_CONFLICT',
      message: 'A operação concorrente não pôde ser concluída com segurança.'
    });
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message });
  }
}
