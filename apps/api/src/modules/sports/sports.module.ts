import { Module } from '@nestjs/common';

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
