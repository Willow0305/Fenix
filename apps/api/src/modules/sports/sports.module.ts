import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AthletesService } from './application/athletes.service';
import { RecruitmentService } from './application/recruitment.service';
import { TeamsService } from './application/teams.service';
import {
  AthletesController,
  MySportsController,
  PublicSportsController,
  RecruitmentController,
  TeamsController
} from './http/sports.controller';

@Module({
  // Conta do atleta menor envia o link para definir a senha (DT-092).
  imports: [AuthModule],
  controllers: [
    PublicSportsController,
    TeamsController,
    AthletesController,
    RecruitmentController,
    MySportsController
  ],
  providers: [TeamsService, AthletesService, RecruitmentService],
  exports: [AthletesService]
})
export class SportsModule {}
