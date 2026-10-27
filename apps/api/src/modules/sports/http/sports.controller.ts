import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { Page } from '../../../common/http/pagination';
import {
  CurrentPrincipal,
  OptionalPrincipal,
  type Principal,
  ReqMeta,
  type RequestMeta
} from '../../../common/http/request-context';
import { defined } from '../../../common/util/defined';
import { PERMISSIONS } from '../../access/domain/permission-catalog';
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import type { IncomingFile } from '../../media/application/media.service';
import { UPLOAD_LIMITS } from '../../settings/http/settings.controller';
import {
  type AthleteDetail,
  type StatusImpact,
  type AthleteInput,
  AthletesService,
  type AthleteSummary
} from '../application/athletes.service';
import {
  type ApplicantInput,
  type InterestedView,
  RecruitmentService,
  type TryoutRegistrationView,
  type TryoutView
} from '../application/recruitment.service';
import {
  type CategoryView,
  type RosterCategoryView,
  TeamsService,
  type TeamView
} from '../application/teams.service';
import {
  ApplicantDto,
  AthleteDto,
  AthleteListQueryDto,
  AthleteStatusDto,
  SportCategoryDto,
  EndMembershipDto,
  InterestDto,
  InterestedQueryDto,
  TryoutListQueryDto,
  InterestedStatusDto,
  LinkUserDto,
  MembershipDto,
  PublicProfileConsentDto,
  RegistrationQueryDto,
  RegistrationReviewDto,
  RequiredReasonDto,
  RosterQueryDto,
  TeamDto,
  TeamQueryDto,
  TryoutDto,
  TryoutStatusDto,
  UpdateAthleteDto,
  UpdateCategoryDto,
  UpdateTeamDto,
  UpdateTryoutDto
} from './sports.dto';
import { DeleteReasonDto } from '../../../common/http/delete-reason.dto';

function toApplicant(dto: ApplicantDto): ApplicantInput {
  const rest: Partial<ApplicantDto> = { ...dto };

  delete rest.privacyConsent;

  return defined(rest) as ApplicantInput;
}

const PUBLIC_FORM_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Site público')
@Public()
@Controller('public')
export class PublicSportsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly recruitment: RecruitmentService
  ) {}

  @Get('teams')
  teamsList(): Promise<TeamView[]> {
    return this.teams.teams({ includeInactive: false, withCounts: false });
  }

  @Get('teams-roster')
  roster(@Query() query: RosterQueryDto): Promise<RosterCategoryView[]> {
    return this.teams.publicRoster(query.type);
  }

  @Get('teams/:slug')
  team(@Param('slug') slug: string): Promise<TeamView> {
    return this.teams.teamBySlug(slug);
  }

  @Get('categories')
  categories(): Promise<CategoryView[]> {
    return this.teams.categories(false);
  }

  @Get('tryouts')
  tryouts(): Promise<TryoutView[]> {
    return this.recruitment.listTryouts(true);
  }

  @Get('tryouts/:slug')
  tryout(@Param('slug') slug: string): Promise<TryoutView> {
    return this.recruitment.getTryout(slug, true);
  }

  @Post('tryouts/:slug/registrations')
  @Throttle(PUBLIC_FORM_LIMIT)
  register(
    @Param('slug') slug: string,
    @Body() body: ApplicantDto,
    @OptionalPrincipal() principal: Principal | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<TryoutRegistrationView> {
    return this.recruitment.registerToTryout(slug, toApplicant(body), principal, meta);
  }

  @Post('interest')
  @Throttle(PUBLIC_FORM_LIMIT)
  interest(
    @Body() body: InterestDto,
    @OptionalPrincipal() principal: Principal | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<{ id: string }> {
    const { notes, ...applicant } = body;

    return this.recruitment.registerInterest(
      { ...toApplicant(applicant as ApplicantDto), ...(notes === undefined ? {} : { notes }) },
      principal,
      meta
    );
  }
}

@ApiTags('Equipes e categorias')
@ApiBearerAuth()
@Controller()
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('sport-categories')
  @RequirePermissions(PERMISSIONS.athletesRead)
  categories(@Query() query: TeamQueryDto): Promise<CategoryView[]> {
    return this.teams.categories(query.includeInactive ?? true);
  }

  @Post('sport-categories')
  @RequirePermissions(PERMISSIONS.teamsManage)
  createCategory(
    @CurrentPrincipal() actor: Principal,
    @Body() body: SportCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CategoryView> {
    return this.teams.createCategory(actor, defined(body), meta);
  }

  @Patch('sport-categories/:id')
  @RequirePermissions(PERMISSIONS.teamsManage)
  updateCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCategoryDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<CategoryView> {
    return this.teams.updateCategory(actor, id, defined(body), meta);
  }

  @Delete('sport-categories/:id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.teamsManage)
  async deleteCategory(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeleteReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<void> {
    await this.teams.deleteCategory(actor, id, body.reason, meta);
  }

  @Get('teams')
  @RequirePermissions(PERMISSIONS.athletesRead)
  list(@Query() query: TeamQueryDto): Promise<TeamView[]> {
    return this.teams.teams({ includeInactive: query.includeInactive ?? true, withCounts: true });
  }

  @Post('teams')
  @RequirePermissions(PERMISSIONS.teamsManage)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: TeamDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TeamView> {
    return this.teams.createTeam(actor, defined(body), meta);
  }

  @Patch('teams/:id')
  @RequirePermissions(PERMISSIONS.teamsManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTeamDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TeamView> {
    return this.teams.updateTeam(actor, id, defined(body), meta);
  }

  @Put('teams/:id/logo')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.teamsManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  setLogo(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<TeamView> {
    return this.teams.setLogo(actor, id, file, meta);
  }

  @Delete('teams/:id/logo')
  @RequirePermissions(PERMISSIONS.teamsManage)
  removeLogo(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<TeamView> {
    return this.teams.setLogo(actor, id, null, meta);
  }
}

@ApiTags('Atletas')
@ApiBearerAuth()
@Controller('athletes')
export class AthletesController {
  constructor(private readonly athletes: AthletesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.athletesRead)
  list(@Query() query: AthleteListQueryDto): Promise<Page<AthleteSummary>> {
    return this.athletes.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.athletesRead)
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AthleteDetail> {
    return this.athletes.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.athletesCreate)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: AthleteDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.create(actor, defined(body) as AthleteInput, meta);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.athletesUpdate)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateAthleteDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.update(actor, id, defined(body), meta);
  }

  @Get(':id/status-impact')
  @RequirePermissions(PERMISSIONS.athletesStatusChange)
  statusImpact(@Param('id', new ParseUUIDPipe()) id: string): Promise<StatusImpact> {
    return this.athletes.statusImpact(id);
  }

  @Put(':id/status')
  @RequirePermissions(PERMISSIONS.athletesStatusChange)
  status(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AthleteStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    const { status, reason, ...effects } = body;

    return this.athletes.changeStatus(actor, id, status, reason, meta, effects);
  }

  @Put(':id/public-profile-consent')
  @RequirePermissions(PERMISSIONS.athletesUpdate)
  publicProfileConsent(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PublicProfileConsentDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.setPublicProfileConsent(actor, id, body.granted, body.reason, meta);
  }

  @Put(':id/user')
  @RequirePermissions(PERMISSIONS.athletesUpdate)
  linkUser(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: LinkUserDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.linkUser(actor, id, body.email, meta);
  }

  @Post(':id/user/unlink')
  @RequirePermissions(PERMISSIONS.athletesUpdate)
  unlinkUser(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RequiredReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.unlinkUser(actor, id, body.reason, meta);
  }

  @Post(':id/memberships')
  @RequirePermissions(PERMISSIONS.teamsAssign)
  addMembership(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MembershipDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.addMembership(actor, id, defined(body), meta);
  }

  @Post(':id/memberships/:membershipId/end')
  @RequirePermissions(PERMISSIONS.teamsAssign)
  endMembership(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() body: EndMembershipDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.athletes.endMembership(actor, id, membershipId, body.endsOn, body.reason, meta);
  }
}

@ApiTags('Captação (interessados e seletivas)')
@ApiBearerAuth()
@Controller()
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Get('interested-people')
  @RequirePermissions(PERMISSIONS.registrationsRead)
  interested(@Query() query: InterestedQueryDto): Promise<Page<InterestedView>> {
    return this.recruitment.listInterested(query);
  }

  @Put('interested-people/:id/status')
  @RequirePermissions(PERMISSIONS.registrationsReview)
  interestedStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: InterestedStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<InterestedView> {
    return this.recruitment.changeInterestedStatus(
      actor,
      id,
      body.status,
      body.reason ?? null,
      meta
    );
  }

  @Post('interested-people/:id/convert')
  @RequirePermissions(PERMISSIONS.registrationsReview, PERMISSIONS.athletesCreate)
  convertInterested(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AthleteDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.recruitment.convertInterested(actor, id, defined(body) as AthleteInput, meta);
  }

  @Get('tryouts')
  @RequirePermissions(PERMISSIONS.registrationsRead)
  tryouts(@Query() query: TryoutListQueryDto): Promise<Page<TryoutView>> {
    return this.recruitment.listTryoutsPage(query);
  }

  @Get('tryouts/:id')
  @RequirePermissions(PERMISSIONS.registrationsRead)
  tryout(@Param('id', new ParseUUIDPipe()) id: string): Promise<TryoutView> {
    return this.recruitment.getTryout(id, false);
  }

  @Post('tryouts')
  @RequirePermissions(PERMISSIONS.tryoutsManage)
  createTryout(
    @CurrentPrincipal() actor: Principal,
    @Body() body: TryoutDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TryoutView> {
    return this.recruitment.createTryout(actor, defined(body), meta);
  }

  @Patch('tryouts/:id')
  @RequirePermissions(PERMISSIONS.tryoutsManage)
  updateTryout(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTryoutDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TryoutView> {
    return this.recruitment.updateTryout(actor, id, defined(body), meta);
  }

  @Put('tryouts/:id/status')
  @RequirePermissions(PERMISSIONS.tryoutsManage)
  tryoutStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TryoutStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TryoutView> {
    return this.recruitment.changeTryoutStatus(actor, id, body.status, body.reason ?? null, meta);
  }

  @Get('tryouts/:id/registrations')
  @RequirePermissions(PERMISSIONS.registrationsRead)
  registrations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RegistrationQueryDto
  ): Promise<Page<TryoutRegistrationView>> {
    return this.recruitment.listRegistrations(id, query);
  }

  @Put('tryout-registrations/:id/status')
  @RequirePermissions(PERMISSIONS.registrationsReview)
  review(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RegistrationReviewDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<TryoutRegistrationView> {
    return this.recruitment.reviewRegistration(actor, id, body.status, body.reason ?? null, meta);
  }

  @Post('tryout-registrations/:id/convert')
  @RequirePermissions(PERMISSIONS.registrationsReview, PERMISSIONS.athletesCreate)
  convertRegistration(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AthleteDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AthleteDetail> {
    return this.recruitment.convertRegistration(actor, id, defined(body) as AthleteInput, meta);
  }
}

@ApiTags('Minha conta')
@ApiBearerAuth()
@Controller('me')
export class MySportsController {
  constructor(
    private readonly athletes: AthletesService,
    private readonly recruitment: RecruitmentService
  ) {}

  /** Somente o registro próprio; 404 se a conta não estiver vinculada (RF-019). */
  @Get('athlete')
  async athlete(@CurrentPrincipal() principal: Principal): Promise<AthleteDetail> {
    const own = await this.athletes.getOwn(principal.userId);

    if (own === null) {
      throw new NotFoundException('Sua conta ainda não está vinculada a um cadastro de atleta.');
    }

    return own;
  }

  @Get('tryout-registrations')
  registrations(@CurrentPrincipal() principal: Principal): Promise<TryoutRegistrationView[]> {
    return this.recruitment.myRegistrations(principal.userId);
  }
}
