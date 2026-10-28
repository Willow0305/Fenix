import { Module } from '@nestjs/common';

import { ClosingsService } from './application/closings.service';
import { FeeRemindersService } from './application/fee-reminders.service';
import { FeesService } from './application/fees.service';
import { FinanceCatalogSync } from './application/finance-catalog-sync';
import { FinanceReportsService } from './application/finance-reports.service';
import { FinanceSetupService } from './application/finance-setup.service';
import { LedgerService } from './application/ledger.service';
import { ObligationsService } from './application/obligations.service';
import { PaymentsService } from './application/payments.service';
import { FeesController, FinanceController } from './http/finance.controller';

@Module({
  controllers: [FinanceController, FeesController],
  providers: [
    FinanceSetupService,
    LedgerService,
    PaymentsService,
    FeesService,
    FeeRemindersService,
    ObligationsService,
    ClosingsService,
    FinanceReportsService,
    FinanceCatalogSync
  ],
  exports: [LedgerService, PaymentsService, FeesService, FinanceReportsService]
})
export class FinanceModule {}
