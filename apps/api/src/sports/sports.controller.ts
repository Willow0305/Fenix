import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSION_CODES } from '../access-control/access.constants';
import { RequirePermissions } from '../access-control/access.decorators';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import type {
  AuthenticatedPrincipal,
  RequestWithPrincipal
} from '../common/http/request-with-principal';
import { RateLimited } from '../rate-limit/rate-limit.decorator';
import { CreateAthleteAffiliationDto, CreateAthleteDto, UpdateAthleteDto } from './dto/athlete.dto';
import { CreateSportCategoryDto, UpdateSportCategoryDto } from './dto/category.dto';
import { CreateGuardianDto, LinkGuardianDto } from './dto/guardian.dto';
import { SportsQueryDto } from './dto/sports-query.dto';
import { CreateTeamDto, LinkTeamCategoryDto, UpdateTeamDto } from './dto/team.dto';
import {
  ConvertTryoutRegistrationDto,
  CreateTryoutDto,
  CreateTryoutRegistrationDto,
  UpdateTryoutDto,
  UpdateTryoutRegistrationStatusDto
} from './dto/tryout.dto';
import { SportsService } from './sports.service';

@ApiTags('esportivo')
@Controller('sports')
export class SportsController {
  public constructor(private readonly sports: SportsService) {}

  @Get('summary')
  @RequirePermissions(PERMISSION_CODES.sportsRead)
  @ApiOperation({ summary: 'Retorna indicadores esportivos administrativos mínimos.' })
  public summary() {
    return this.sports.summary();
  }

  @Get('categories')
  @RequirePermissions(PERMISSION_CODES.sportsRead)
  public listCategories(@Query() query: SportsQueryDto) {
    return this.sports.listCategories(query);
  }

  @Post('categories')
  @RequirePermissions(PERMISSION_CODES.categoriesManage)
  @RateLimited('adminSensitive')
  public createCategory(
    @Body() body: CreateSportCategoryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createCategory(body, principal.userId, request);
  }

  @Patch('categories/:categoryId')
  @RequirePermissions(PERMISSION_CODES.categoriesManage)
  @RateLimited('adminSensitive')
  public updateCategory(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() body: UpdateSportCategoryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.updateCategory(categoryId, body, principal.userId, request);
  }

  @Get('teams')
  @RequirePermissions(PERMISSION_CODES.sportsRead)
  public listTeams(@Query() query: SportsQueryDto) {
    return this.sports.listTeams(query);
  }

  @Post('teams')
  @RequirePermissions(PERMISSION_CODES.teamsManage)
  @RateLimited('adminSensitive')
  public createTeam(
    @Body() body: CreateTeamDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createTeam(body, principal.userId, request);
  }

  @Patch('teams/:teamId')
  @RequirePermissions(PERMISSION_CODES.teamsManage)
  @RateLimited('adminSensitive')
  public updateTeam(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() body: UpdateTeamDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.updateTeam(teamId, body, principal.userId, request);
  }

  @Post('teams/:teamId/categories')
  @RequirePermissions(PERMISSION_CODES.teamsManage)
  @RateLimited('adminSensitive')
  public linkTeamCategory(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() body: LinkTeamCategoryDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.linkTeamCategory(teamId, body, principal.userId, request);
  }

  @Get('athletes')
  @RequirePermissions(PERMISSION_CODES.athletesRead)
  public listAthletes(@Query() query: SportsQueryDto) {
    return this.sports.listAthletes(query);
  }

  @Post('athletes')
  @RequirePermissions(PERMISSION_CODES.athletesCreate)
  @RateLimited('adminSensitive')
  public createAthlete(
    @Body() body: CreateAthleteDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createAthlete(body, principal.userId, request);
  }

  @Patch('athletes/:athleteId')
  @RequirePermissions(PERMISSION_CODES.athletesUpdate)
  @RateLimited('adminSensitive')
  public updateAthlete(
    @Param('athleteId', new ParseUUIDPipe()) athleteId: string,
    @Body() body: UpdateAthleteDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.updateAthlete(athleteId, body, principal.userId, request);
  }

  @Post('athletes/:athleteId/affiliations')
  @RequirePermissions(PERMISSION_CODES.teamsAssign)
  @RateLimited('adminSensitive')
  public createAffiliation(
    @Param('athleteId', new ParseUUIDPipe()) athleteId: string,
    @Body() body: CreateAthleteAffiliationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createAffiliation(athleteId, body, principal.userId, request);
  }

  @Post('athletes/:athleteId/guardians')
  @RequirePermissions(PERMISSION_CODES.guardiansManage)
  @RateLimited('adminSensitive')
  public linkGuardian(
    @Param('athleteId', new ParseUUIDPipe()) athleteId: string,
    @Body() body: LinkGuardianDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.linkGuardian(athleteId, body, principal.userId, request);
  }

  @Get('guardians')
  @RequirePermissions(PERMISSION_CODES.guardiansManage)
  public listGuardians(@Query() query: SportsQueryDto) {
    return this.sports.listGuardians(query);
  }

  @Post('guardians')
  @RequirePermissions(PERMISSION_CODES.guardiansManage)
  @RateLimited('adminSensitive')
  public createGuardian(
    @Body() body: CreateGuardianDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createGuardian(body, principal.userId, request);
  }

  @Get('tryouts')
  @RequirePermissions(PERMISSION_CODES.sportsRead)
  public listTryouts(@Query() query: SportsQueryDto) {
    return this.sports.listTryouts(query);
  }

  @Post('tryouts')
  @RequirePermissions(PERMISSION_CODES.tryoutsManage)
  @RateLimited('adminSensitive')
  public createTryout(
    @Body() body: CreateTryoutDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createTryout(body, principal.userId, request);
  }

  @Patch('tryouts/:tryoutId')
  @RequirePermissions(PERMISSION_CODES.tryoutsManage)
  @RateLimited('adminSensitive')
  public updateTryout(
    @Param('tryoutId', new ParseUUIDPipe()) tryoutId: string,
    @Body() body: UpdateTryoutDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.updateTryout(tryoutId, body, principal.userId, request);
  }

  @Get('registrations')
  @RequirePermissions(PERMISSION_CODES.registrationsRead)
  public listRegistrations(@Query() query: SportsQueryDto) {
    return this.sports.listRegistrations(query);
  }

  @Post('registrations')
  @RequirePermissions(PERMISSION_CODES.registrationsReview)
  @RateLimited('adminSensitive')
  public createRegistration(
    @Body() body: CreateTryoutRegistrationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.createRegistration(body, principal.userId, request);
  }

  @Patch('registrations/:registrationId/status')
  @RequirePermissions(PERMISSION_CODES.registrationsReview)
  @RateLimited('adminSensitive')
  public updateRegistrationStatus(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body() body: UpdateTryoutRegistrationStatusDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.updateRegistrationStatus(registrationId, body, principal.userId, request);
  }

  @Post('registrations/:registrationId/convert')
  @RequirePermissions(PERMISSION_CODES.registrationsConvert)
  @RateLimited('adminSensitive')
  public convertRegistration(
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body() body: ConvertTryoutRegistrationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: RequestWithPrincipal
  ) {
    return this.sports.convertRegistration(registrationId, body, principal.userId, request);
  }
}
