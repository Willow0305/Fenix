import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { parseMoney } from '../../../common/domain/money';
import { IdempotencyKey } from '../../../common/http/idempotency';
import type { Page } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { RequirePermissions } from '../../auth/http/auth.decorators';
import type { IncomingFile } from '../../media/application/media.service';
import { UPLOAD_LIMITS } from '../../settings/http/settings.controller';
import {
  type ClosingPreview,
  ClosingsService,
  type ClosingView
} from '../application/closings.service';
import {
  type FeeDetail,
  FeesService,
  type FeeView,
  type PlanView,
  type AthletePlanView,
  type BulkAssignResult,
  type PlanMemberView
} from '../application/fees.service';
import {
  FinanceReportsService,
  type FinanceSummary,
  type FinanceTrend
} from '../application/finance-reports.service';
import {
  type AccountView,
  type CategoryView,
  type CostCenterView,
  FinanceSetupService,
  type PaymentMethodView
} from '../application/finance-setup.service';
import { LedgerService, type TransactionView } from '../application/ledger.service';
import { type ObligationView, ObligationsService } from '../application/obligations.service';
import {
  AccountDto,
  ActiveDto,
  AdjustFeeDto,
  AssignManyDto,
  AssignPlanDto,
  FinanceCategoryDto,
  ClosingDto,
  DueDateDto,
  ClosingListDto,
  ClosingPreviewDto,
  ConfirmPaymentDto,
  EndPlanDto,
  FeePaymentDto,
  FeeQueryDto,
  GenerateFeesDto,
  ManualTransactionDto,
  NameActiveDto,
  NameDto,
  ObligationDto,
  ObligationQueryDto,
  OpeningBalanceDto,
  PlanDto,
  ProofDto,
  ReasonBodyDto,
  ReconcileDto,
  SettleDto,
  SummaryQueryDto,
  TrendQueryDto,
  TransactionQueryDto,
  TransferDto,
  UpdateAccountDto,
  UpdatePlanDto
} from './finance.dto';
import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';

export function sendFile(
  res: Response,
  file: { content: Buffer; mimeType: string; fileName: string }
): void {
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  res.send(file.content);
}

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };

@ApiTags('Caixa Fênix')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly setup: FinanceSetupService,
    private readonly ledger: LedgerService,
    private readonly obligations: ObligationsService,
    private readonly closings: ClosingsService,
    private readonly reports: FinanceReportsService
  ) {}

  // ----- Cadastros -----

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.financeRead)
  accounts(): Promise<AccountView[]> {
    return this.setup.accounts();
  }

  @Post('accounts')
  @RequirePermissions(PERMISSIONS.financeSetup)
  createAccount(
    @CurrentPrincipal() actor: Principal,
    @Body() body: AccountDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AccountView> {
    return this.setup.createAccount(actor, defined(body), meta);
  }

  @Patch('accounts/:id')
  @RequirePermissions(PERMISSIONS.financeSetup)
  updateAccount(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAccountDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AccountView> {
    return this.setup.updateAccount(actor, id, defined(body), meta);
  }

  @Post('accounts/:id/opening-balance')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.financeSetup, PERMISSIONS.transactionsConfirm)
  openingBalance(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: OpeningBalanceDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.openingBalance(
      actor,
      id,
      { amount: parseMoney(body.amount), occurredOn: body.occurredOn, notes: body.notes },
      key,
      meta
    );
  }

  @Get('categories')
  @RequirePermissions(PERMISSIONS.financeRead)
  categories(): Promise<CategoryView[]> {
    return this.setup.categories();
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.financeSetup)
  createCategory(
    @CurrentPrincipal() actor: Principal,
    @Body() body: FinanceCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CategoryView> {
    return this.setup.createCategory(actor, body, meta);
  }

  @Patch('categories/:id')
  @RequirePermissions(PERMISSIONS.financeSetup)
  updateCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NameActiveDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CategoryView> {
    return this.setup.updateCategory(actor, id, defined(body), meta);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.financeSetup)
  async deleteCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.setup.deleteCategory(actor, id, body.reason, meta);
  }

  @Get('cost-centers')
  @RequirePermissions(PERMISSIONS.financeRead)
  costCenters(): Promise<CostCenterView[]> {
    return this.setup.costCenters();
  }

  @Post('cost-centers')
  @RequirePermissions(PERMISSIONS.financeSetup)
  createCostCenter(
    @CurrentPrincipal() actor: Principal,
    @Body() body: NameDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CostCenterView> {
    return this.setup.createCostCenter(actor, body, meta);
  }

  @Patch('cost-centers/:id')
  @RequirePermissions(PERMISSIONS.financeSetup)
  updateCostCenter(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: NameActiveDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CostCenterView> {
    return this.setup.updateCostCenter(actor, id, defined(body), meta);
  }

  @Delete('cost-centers/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.financeSetup)
  async deleteCostCenter(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.setup.deleteCostCenter(actor, id, body.reason, meta);
  }

  @Get('payment-methods')
  paymentMethods(): Promise<PaymentMethodView[]> {
    return this.setup.paymentMethods();
  }

  @Put('payment-methods/:id/active')
  @RequirePermissions(PERMISSIONS.financeSetup)
  setPaymentMethod(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ActiveDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PaymentMethodView> {
    return this.setup.setPaymentMethodActive(actor, id, body.isActive, meta);
  }

  // ----- Visão e relatórios -----

  @Get('summary')
  @RequirePermissions(PERMISSIONS.financeRead)
  summary(@Query() query: SummaryQueryDto): Promise<FinanceSummary> {
    return this.reports.summary(query.from, query.to);
  }

  /** Série mensal do painel financeiro (DT-058); mensalidades só com `fees.read`. */
  @Get('trend')
  @RequirePermissions(PERMISSIONS.financeRead)
  trend(
    @CurrentPrincipal() actor: Principal,
    @Query() query: TrendQueryDto
  ): Promise<FinanceTrend> {
    return this.reports.trend(query.months ?? 12, actor.permissions.has(PERMISSIONS.feesRead));
  }

  // ----- Lançamentos -----

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.financeRead)
  transactions(@Query() query: TransactionQueryDto): Promise<Page<TransactionView>> {
    return this.ledger.list(query);
  }

  @Get('transactions/:id')
  @RequirePermissions(PERMISSIONS.financeRead)
  transaction(@Param('id', new ParseUUIDPipe()) id: string): Promise<TransactionView> {
    return this.ledger.get(id);
  }

  @Post('transactions')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.transactionsCreate)
  createTransaction(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ManualTransactionDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    const { amount, ...rest } = body;

    return this.ledger.createManual(
      actor,
      { ...defined(rest), amount: parseMoney(amount) },
      key,
      meta
    );
  }

  @Post('transactions/:id/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.transactionsConfirm)
  confirm(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.confirm(actor, id, meta);
  }

  @Post('transactions/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.transactionsCancel)
  cancel(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.cancel(actor, id, body.reason, meta);
  }

  @Post('transactions/:id/reverse')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.transactionsCancel)
  reverse(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.reverse(actor, id, body.reason, key, meta);
  }

  @Post('transactions/:id/reconcile')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.cashReconcile)
  reconcile(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReconcileDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.markReconciled(actor, id, body.statementReference?.trim() || null, meta);
  }

  @Post('transactions/:id/attachments')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.transactionsCreate, PERMISSIONS.filesUpload)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  attach(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<TransactionView> {
    return this.ledger.attach(actor, id, file, meta);
  }

  @Get('transactions/:id/attachments/:attachmentId')
  @RequirePermissions(PERMISSIONS.financeRead, PERMISSIONS.filesReadRestricted)
  async attachment(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() res: Response
  ): Promise<void> {
    sendFile(res, await this.ledger.attachmentFile(id, attachmentId, actor));
  }

  @Post('transfers')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.transactionsCreate, PERMISSIONS.transactionsConfirm)
  transfer(
    @CurrentPrincipal() actor: Principal,
    @Body() body: TransferDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ id: string; debit: TransactionView; credit: TransactionView }> {
    const { amount, ...rest } = body;

    return this.ledger.transfer(actor, { ...defined(rest), amount: parseMoney(amount) }, key, meta);
  }

  // ----- Contas a pagar/receber -----

  @Get('obligations')
  @RequirePermissions(PERMISSIONS.financeRead)
  obligationList(@Query() query: ObligationQueryDto): ReturnType<ObligationsService['list']> {
    return this.obligations.list(query);
  }

  @Post('obligations')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.transactionsCreate)
  createObligation(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ObligationDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<ObligationView> {
    const { amount, ...rest } = body;

    return this.obligations.create(
      actor,
      { ...defined(rest), amount: parseMoney(amount) },
      key,
      meta
    );
  }

  @Post('obligations/:id/settle')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.transactionsConfirm)
  settle(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SettleDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ObligationView> {
    return this.obligations.settle(actor, id, defined(body), meta);
  }

  @Post('obligations/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.transactionsCancel)
  cancelObligation(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ObligationView> {
    return this.obligations.cancel(actor, id, body.reason, meta);
  }

  // ----- Fechamento -----

  @Get('closings')
  @RequirePermissions(PERMISSIONS.financeRead)
  closingList(@Query() query: ClosingListDto): Promise<ClosingView[]> {
    return this.closings.list(query.accountId);
  }

  @Get('closings/preview')
  @RequirePermissions(PERMISSIONS.cashReconcile)
  preview(@Query() query: ClosingPreviewDto): Promise<ClosingPreview> {
    return this.closings.preview(query.accountId, query.periodStart, query.periodEnd);
  }

  @Post('closings')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.cashClose)
  close(
    @CurrentPrincipal() actor: Principal,
    @Body() body: ClosingDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<ClosingView[]> {
    const { countedBalance, ...rest } = body;

    return this.closings.close(
      actor,
      {
        ...defined(rest),
        countedBalance: parseMoney(countedBalance, 'countedBalance', { allowZero: true })
      },
      key,
      meta
    );
  }

  @Post('closings/:id/reopen')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.cashReopen)
  reopen(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ClosingView[]> {
    return this.closings.reopen(actor, id, body.reason, meta);
  }
}

@ApiTags('Mensalidades')
@ApiBearerAuth()
@Controller()
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get('fee-plans')
  @RequirePermissions(PERMISSIONS.feesRead)
  plans(): Promise<PlanView[]> {
    return this.fees.plans();
  }

  @Post('fee-plans')
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  createPlan(
    @CurrentPrincipal() actor: Principal,
    @Body() body: PlanDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PlanView> {
    const { amount, ...rest } = body;

    return this.fees.createPlan(actor, { ...defined(rest), amount: parseMoney(amount) }, meta);
  }

  @Patch('fee-plans/:id')
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  updatePlan(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePlanDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PlanView> {
    const { amount, ...rest } = body;

    return this.fees.updatePlan(
      actor,
      id,
      { ...defined(rest), ...(amount === undefined ? {} : { amount: parseMoney(amount) }) },
      meta
    );
  }

  @Delete('fee-plans/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  async deletePlan(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.fees.deletePlan(actor, id, body.reason, meta);
  }

  @Get('fee-plans/:id/athletes')
  @RequirePermissions(PERMISSIONS.feesRead)
  planMembers(@Param('id', new ParseUUIDPipe()) id: string): Promise<PlanMemberView[]> {
    return this.fees.planMembers(id);
  }

  @Post('fee-plans/:id/athletes')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  assignMany(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AssignManyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<BulkAssignResult> {
    const { amountOverride, ...rest } = body;

    return this.fees.assignMany(
      actor,
      id,
      {
        ...defined(rest),
        ...(amountOverride === undefined
          ? {}
          : { amountOverride: parseMoney(amountOverride, 'amountOverride', { allowZero: true }) })
      },
      meta
    );
  }

  @Get('athletes/:id/fee-plans')
  @RequirePermissions(PERMISSIONS.feesRead)
  athletePlans(@Param('id', new ParseUUIDPipe()) id: string): Promise<AthletePlanView[]> {
    return this.fees.athletePlans(id);
  }

  @Post('athletes/:id/fee-plans')
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  assign(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AssignPlanDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthletePlanView[]> {
    const { amountOverride, ...rest } = body;

    return this.fees.assignPlan(
      actor,
      id,
      {
        ...defined(rest),
        ...(amountOverride === undefined
          ? {}
          : { amountOverride: parseMoney(amountOverride, 'amountOverride', { allowZero: true }) })
      },
      meta
    );
  }

  @Post('athletes/:id/fee-plans/:planLinkId/end')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.feesManagePlans)
  endPlan(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('planLinkId', new ParseUUIDPipe()) planLinkId: string,
    @Body() body: EndPlanDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthletePlanView[]> {
    return this.fees.endPlan(actor, id, planLinkId, body.endsOn, body.reason, meta);
  }

  @Post('monthly-fees/generate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.feesGenerate)
  generate(
    @CurrentPrincipal() actor: Principal,
    @Body() body: GenerateFeesDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ created: number; skipped: number }> {
    return this.fees.generate(actor, body.referenceMonth, meta);
  }

  @Get('monthly-fees')
  @RequirePermissions(PERMISSIONS.feesRead)
  list(@Query() query: FeeQueryDto): Promise<Page<FeeView>> {
    return this.fees.list(query);
  }

  @Get('monthly-fees/:id')
  @RequirePermissions(PERMISSIONS.feesRead)
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<FeeDetail> {
    return this.fees.get(id);
  }

  @Post('monthly-fees/:id/payments')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.paymentsRecord)
  recordPayment(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: FeePaymentDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    const { amount, ...rest } = body;

    return this.fees.recordPayment(
      actor,
      id,
      { ...defined(rest), amount: parseMoney(amount) },
      key,
      meta
    );
  }

  @Post('monthly-fees/:id/payments/:paymentId/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.paymentsConfirm)
  confirmPayment(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() body: ConfirmPaymentDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    return this.fees.confirmPayment(actor, id, paymentId, body.accountId, meta);
  }

  @Post('monthly-fees/:id/payments/:paymentId/reverse')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.paymentsCorrect)
  reversePayment(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() body: ReasonBodyDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    return this.fees.reversePayment(actor, id, paymentId, body.reason, key, meta);
  }

  @Post('monthly-fees/:id/adjust')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.feesAdjust)
  adjust(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdjustFeeDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    return this.fees.adjust(
      actor,
      id,
      {
        reason: body.reason,
        ...(body.discountAmount === undefined
          ? {}
          : {
              discountAmount: parseMoney(body.discountAmount, 'discountAmount', { allowZero: true })
            }),
        ...(body.additionalAmount === undefined
          ? {}
          : {
              additionalAmount: parseMoney(body.additionalAmount, 'additionalAmount', {
                allowZero: true
              })
            })
      },
      meta
    );
  }

  @Put('monthly-fees/:id/due-date')
  @RequirePermissions(PERMISSIONS.feesAdjust)
  dueDate(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DueDateDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    return this.fees.changeDueDate(actor, id, body.dueDate, body.reason, meta);
  }

  @Post('monthly-fees/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.feesAdjust)
  cancel(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReasonBodyDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    return this.fees.cancel(actor, id, body.reason, meta);
  }

  @Get('payments/:paymentId/attachments/:attachmentId')
  async paymentAttachment(
    @CurrentPrincipal() actor: Principal,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() res: Response
  ): Promise<void> {
    sendFile(res, await this.fees.paymentAttachment(actor, paymentId, attachmentId));
  }

  // ----- Área do atleta -----

  @Get('me/monthly-fees')
  mine(@CurrentPrincipal() principal: Principal): Promise<FeeView[]> {
    return this.fees.mine(principal.userId);
  }

  @Get('me/monthly-fees/:id')
  mineDetail(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<FeeDetail> {
    return this.fees.get(id, principal.userId);
  }

  @Post('me/monthly-fees/:id/proof')
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  submitProof(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProofDto,
    @UploadedFile() file: IncomingFile | undefined,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<FeeDetail> {
    const { amount, ...rest } = body;

    return this.fees.submitProof(
      principal,
      id,
      { ...defined(rest), amount: parseMoney(amount) },
      file,
      key,
      meta
    );
  }
}
