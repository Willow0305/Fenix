import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnprocessableEntityException
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSION_CODES } from '../access-control/access.constants';
import { RequirePermissions } from '../access-control/access.decorators';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { RateLimited } from '../rate-limit/rate-limit.decorator';
import { CloseCashSessionDto, OpenCashSessionDto } from './dto/cash.dto';
import {
  CreateCostCenterDto,
  CreateFinancialAccountDto,
  CreateFinancialCategoryDto
} from './dto/catalog.dto';
import { FinanceQueryDto } from './dto/finance-query.dto';
import {
  CreateFinancialObligationDto,
  CreateFinancialTransferDto,
  CreatePendingFinancialTransactionDto,
  FinancialDecisionDto
} from './dto/ledger.dto';
import {
  CreateFinancialChargeDto,
  CreateFinancialPlanDto,
  CreateFinancialPlanVersionDto
} from './dto/plan-charge.dto';
import { CreateFinancialPaymentDto, ReconcileFinancialPaymentDto } from './dto/payment.dto';
import { FinanceService } from './finance.service';

function requireIdempotencyKey(value: string | undefined): string {
  const normalized = value?.trim();

  if (!normalized || normalized.length < 16 || normalized.length > 160) {
    throw new UnprocessableEntityException({
      code: 'IDEMPOTENCY_KEY_INVALID',
      message: 'Idempotency-Key deve possuir entre 16 e 160 caracteres.'
    });
  }

  if (!/^[A-Za-z0-9_.:-]+$/u.test(normalized)) {
    throw new UnprocessableEntityException({
      code: 'IDEMPOTENCY_KEY_INVALID',
      message: 'Idempotency-Key contém caracteres não permitidos.'
    });
  }

  return normalized;
}

@ApiTags('Caixa Fênix')
@Controller('finance')
export class FinanceController {
  public constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  @ApiOperation({ summary: 'Retorna indicadores mínimos e saldo derivado do razão.' })
  public summary() {
    return this.finance.summary();
  }

  @Get('accounts')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listAccounts(@Query() query: FinanceQueryDto) {
    return this.finance.listAccounts(query);
  }

  @Post('accounts')
  @RequirePermissions(PERMISSION_CODES.financeCatalogsManage)
  @RateLimited('adminSensitive')
  public createAccount(
    @Body() body: CreateFinancialAccountDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createAccount(body, principal.userId, request);
  }

  @Get('categories')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listCategories(@Query() query: FinanceQueryDto) {
    return this.finance.listCategories(query);
  }

  @Post('categories')
  @RequirePermissions(PERMISSION_CODES.financeCatalogsManage)
  @RateLimited('adminSensitive')
  public createCategory(
    @Body() body: CreateFinancialCategoryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createCategory(body, principal.userId, request);
  }

  @Get('cost-centers')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listCostCenters(@Query() query: FinanceQueryDto) {
    return this.finance.listCostCenters(query);
  }

  @Post('cost-centers')
  @RequirePermissions(PERMISSION_CODES.financeCatalogsManage)
  @RateLimited('adminSensitive')
  public createCostCenter(
    @Body() body: CreateCostCenterDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createCostCenter(body, principal.userId, request);
  }

  @Get('plans')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listPlans(@Query() query: FinanceQueryDto) {
    return this.finance.listPlans(query);
  }

  @Post('plans')
  @RequirePermissions(PERMISSION_CODES.financePlansManage)
  @RateLimited('adminSensitive')
  public createPlan(
    @Body() body: CreateFinancialPlanDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createPlan(body, principal.userId, request);
  }

  @Post('plans/:planId/versions')
  @RequirePermissions(PERMISSION_CODES.financePlansManage)
  @RateLimited('adminSensitive')
  public createPlanVersion(
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() body: CreateFinancialPlanVersionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createPlanVersion(planId, body, principal.userId, request);
  }

  @Get('charges')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listCharges(@Query() query: FinanceQueryDto) {
    return this.finance.listCharges(query);
  }

  @Post('charges')
  @RequirePermissions(PERMISSION_CODES.financeChargesManage)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public createCharge(
    @Body() body: CreateFinancialChargeDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createCharge(
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Get('payments')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listPayments(@Query() query: FinanceQueryDto) {
    return this.finance.listPayments(query);
  }

  @Post('payments')
  @RequirePermissions(PERMISSION_CODES.financePaymentsRecord)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public createPayment(
    @Body() body: CreateFinancialPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createPayment(
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Post('payments/:paymentId/reconcile')
  @RequirePermissions(PERMISSION_CODES.financePaymentsReconcile)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public reconcilePayment(
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() body: ReconcileFinancialPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.reconcilePayment(
      paymentId,
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Get('transactions')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listTransactions(@Query() query: FinanceQueryDto) {
    return this.finance.listTransactions(query);
  }

  @Post('transactions')
  @RequirePermissions(PERMISSION_CODES.financeEntriesCreate)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public createPendingTransaction(
    @Body() body: CreatePendingFinancialTransactionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createPendingTransaction(
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Post('transactions/:transactionId/approve')
  @RequirePermissions(PERMISSION_CODES.financeEntriesApprove)
  @RateLimited('adminSensitive')
  public approveTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() body: FinancialDecisionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.approveTransaction(transactionId, body, principal.userId, request);
  }

  @Post('transactions/:transactionId/reject')
  @RequirePermissions(PERMISSION_CODES.financeEntriesApprove)
  @RateLimited('adminSensitive')
  public rejectTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() body: FinancialDecisionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.rejectTransaction(transactionId, body, principal.userId, request);
  }

  @Post('transactions/:transactionId/reverse')
  @RequirePermissions(PERMISSION_CODES.financeReverse)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public reverseTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() body: FinancialDecisionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.reverseTransaction(
      transactionId,
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Get('transfers')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listTransfers(@Query() query: FinanceQueryDto) {
    return this.finance.listTransfers(query);
  }

  @Post('transfers')
  @RequirePermissions(PERMISSION_CODES.financeTransfersManage)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public createTransfer(
    @Body() body: CreateFinancialTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createTransfer(
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Post('transfers/:transferId/approve')
  @RequirePermissions(PERMISSION_CODES.financeTransfersManage)
  @RateLimited('adminSensitive')
  public approveTransfer(
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Body() body: FinancialDecisionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.approveTransfer(transferId, body, principal.userId, request);
  }

  @Post('transfers/:transferId/reject')
  @RequirePermissions(PERMISSION_CODES.financeTransfersManage)
  @RateLimited('adminSensitive')
  public rejectTransfer(
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Body() body: FinancialDecisionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.rejectTransfer(transferId, body, principal.userId, request);
  }

  @Post('transfers/:transferId/reverse')
  @RequirePermissions(PERMISSION_CODES.financeTransfersManage, PERMISSION_CODES.financeReverse)
  @RateLimited('adminSensitive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  public reverseTransfer(
    @Param('transferId', new ParseUUIDPipe()) transferId: string,
    @Body() body: FinancialDecisionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.reverseTransfer(
      transferId,
      body,
      requireIdempotencyKey(idempotencyKey),
      principal.userId,
      request
    );
  }

  @Get('obligations')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listObligations(@Query() query: FinanceQueryDto) {
    return this.finance.listObligations(query);
  }

  @Post('obligations')
  @RequirePermissions(PERMISSION_CODES.financeObligationsManage)
  @RateLimited('adminSensitive')
  public createObligation(
    @Body() body: CreateFinancialObligationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.createObligation(body, principal.userId, request);
  }

  @Get('cash-sessions')
  @RequirePermissions(PERMISSION_CODES.financeRead)
  public listCashSessions(@Query() query: FinanceQueryDto) {
    return this.finance.listCashSessions(query);
  }

  @Post('cash-sessions')
  @RequirePermissions(PERMISSION_CODES.financeCashOperate)
  @RateLimited('adminSensitive')
  public openCashSession(
    @Body() body: OpenCashSessionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.openCashSession(body, principal.userId, request);
  }

  @Post('cash-sessions/:cashSessionId/close')
  @RequirePermissions(PERMISSION_CODES.financeCashClose)
  @RateLimited('adminSensitive')
  public closeCashSession(
    @Param('cashSessionId', new ParseUUIDPipe()) cashSessionId: string,
    @Body() body: CloseCashSessionDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.finance.closeCashSession(cashSessionId, body, principal.userId, request);
  }
}
