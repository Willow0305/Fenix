import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { AppointmentsService } from './application/appointments.service';
import { PartnersService } from './application/partners.service';
import { ProfessionalsService } from './application/professionals.service';
import { SettlementsService } from './application/settlements.service';
import { PartnersController } from './http/partners.controller';

@Module({
  imports: [FinanceModule],
  controllers: [PartnersController],
  providers: [PartnersService, ProfessionalsService, AppointmentsService, SettlementsService],
  exports: [SettlementsService]
})
export class PartnersModule {}
