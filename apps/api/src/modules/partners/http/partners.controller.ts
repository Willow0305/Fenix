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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { type Money, money, parseMoney } from '../../../common/domain/money';
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
import { Public, RequirePermissions } from '../../auth/http/auth.decorators';
import { sendFile } from '../../finance/http/finance.controller';
import type { IncomingFile } from '../../media/application/media.service';
import { UPLOAD_LIMITS } from '../../settings/http/settings.controller';
import {
  type AppointmentView,
  AppointmentsService,
  HEALTH_DATA_NOTICE
} from '../application/appointments.service';
import {
  type PartnerView,
  PartnersService,
  type PublicPartnerView
} from '../application/partners.service';
import {
  type AvailabilityView,
  type ProfessionalView,
  ProfessionalsService,
  type ServiceView
} from '../application/professionals.service';
import {
  type PartnerSalesReport,
  type SettlementView,
  SettlementsService
} from '../application/settlements.service';
import {
  AppointmentQueryDto,
  AppointmentRequestDto,
  AppointmentStatusDto,
  AvailabilityDto,
  AvailabilityQueryDto,
  PartnerDocumentDto,
  PartnerDto,
  PartnerQueryDto,
  PartnerStatusDto,
  ProfessionalDto,
  PartnerReasonDto,
  SalesReportQueryDto,
  ServiceDto,
  ServiceStatusDto,
  SettlementDto,
  SettlementPayDto,
  SettlementQueryDto,
  SettlementStatusDto,
  UpdatePartnerDto,
  UpdateProfessionalDto,
  UpdateServiceDto
} from './partners.dto';

const IDEMPOTENCY_HEADER = { name: 'Idempotency-Key', required: true };

/** Strings vazias dos formulários de edição viram `null` (remover valor). */
function emptyToNull<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, v === '' ? null : v])
  ) as T;
}

function commissionFields(body: {
  commissionPercentage?: string | null;
  commissionFixedAmount?: string | null;
}): { commissionPercentage?: Money | null; commissionFixedAmount?: Money | null } {
  return {
    ...(body.commissionPercentage === undefined
      ? {}
      : {
          commissionPercentage:
            body.commissionPercentage === null ? null : money(body.commissionPercentage)
        }),
    ...(body.commissionFixedAmount === undefined
      ? {}
      : {
          commissionFixedAmount:
            body.commissionFixedAmount === null
              ? null
              : parseMoney(body.commissionFixedAmount, 'commissionFixedAmount', {
                  allowZero: true
                })
        })
  };
}

@ApiTags('Parceiros')
@Controller()
export class PartnersController {
  constructor(
    private readonly partners: PartnersService,
    private readonly professionals: ProfessionalsService,
    private readonly appointments: AppointmentsService,
    private readonly settlements: SettlementsService
  ) {}

  // ---------- Público ----------

  @Get('public/partners')
  @Public()
  publicList(): Promise<PublicPartnerView[]> {
    return this.partners.publicList();
  }

  @Get('public/partners/:id')
  @Public()
  publicGet(@Param('id', new ParseUUIDPipe()) id: string): Promise<PublicPartnerView> {
    return this.partners.publicGet(id);
  }

  @Get('public/partner-services/:id/slots')
  @Public()
  async slots(
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<{ service: ServiceView; slots: AvailabilityView[]; notice: string }> {
    return { ...(await this.professionals.publicSlots(id)), notice: HEALTH_DATA_NOTICE };
  }

  // ---------- Usuário autenticado ----------

  @Post('appointments')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  request(
    @CurrentPrincipal() principal: Principal,
    @Body() body: AppointmentRequestDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AppointmentView> {
    return this.appointments.request(principal, defined(body), meta);
  }

  @Get('me/appointments')
  @ApiBearerAuth()
  mine(@CurrentPrincipal() principal: Principal): Promise<AppointmentView[]> {
    return this.appointments.mine(principal.userId);
  }

  @Post('me/appointments/:id/cancel')
  @HttpCode(200)
  @ApiBearerAuth()
  cancelOwn(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PartnerReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AppointmentView> {
    return this.appointments.cancelOwn(principal, id, body.reason, meta);
  }

  // ---------- Parceiros ----------

  @Get('partners/sales-report')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settlementsManage)
  salesReport(@Query() query: SalesReportQueryDto): Promise<PartnerSalesReport> {
    return this.settlements.salesReport(query.from, query.to, query.partnerId);
  }

  @Get('partners')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage)
  list(@Query() query: PartnerQueryDto): Promise<Page<PartnerView>> {
    return this.partners.list(defined(query));
  }

  @Get('partners/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage)
  get(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<PartnerView> {
    return this.partners.get(id, actor);
  }

  @Post('partners')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage)
  create(
    @CurrentPrincipal() actor: Principal,
    @Body() body: PartnerDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    const { commissionPercentage, commissionFixedAmount, ...rest } = body;

    return this.partners.create(
      actor,
      {
        ...defined(rest),
        ...commissionFields(defined({ commissionPercentage, commissionFixedAmount }))
      },
      meta
    );
  }

  @Patch('partners/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage)
  update(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePartnerDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    const { commissionPercentage, commissionFixedAmount, legalName, displayName, type, ...rest } =
      body;

    return this.partners.update(
      actor,
      id,
      {
        ...defined({ legalName, displayName, type }),
        ...emptyToNull(defined(rest)),
        ...commissionFields(defined({ commissionPercentage, commissionFixedAmount }))
      },
      meta
    );
  }

  @Put('partners/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage)
  status(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PartnerStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    return this.partners.changeStatus(actor, id, body.status, body.reason, meta);
  }

  @Post('partners/:id/logo')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.partnersManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  logo(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    return this.partners.setLogo(actor, id, file, meta);
  }

  @Post('partners/:id/cover')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.partnersManage)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  cover(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    return this.partners.setCover(actor, id, file, meta);
  }

  @Post('partners/:id/documents')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(PERMISSIONS.partnersManage, PERMISSIONS.partnerDocumentsRead)
  @UseInterceptors(FileInterceptor('file', UPLOAD_LIMITS))
  addDocument(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PartnerDocumentDto,
    @UploadedFile() file: IncomingFile | undefined,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    return this.partners.addDocument(actor, id, defined(body), file, meta);
  }

  @Delete('partners/:id/documents/:documentId')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnersManage, PERMISSIONS.partnerDocumentsRead)
  removeDocument(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() body: PartnerReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<PartnerView> {
    return this.partners.removeDocument(actor, id, documentId, body.reason, meta);
  }

  @Get('partners/:id/documents/:documentId/file')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.partnerDocumentsRead)
  async documentFile(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @ReqMeta() meta: RequestMeta,
    @Res() res: Response
  ): Promise<void> {
    sendFile(res, await this.partners.documentFile(actor, id, documentId, meta));
  }

  // ---------- Profissionais e serviços ----------

  @Get('professionals')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  listProfessionals(@Query('partnerId') partnerId?: string): Promise<ProfessionalView[]> {
    return this.professionals.listProfessionals(
      partnerId && /^[0-9a-f-]{36}$/i.test(partnerId) ? partnerId : undefined
    );
  }

  @Post('partners/:id/professionals')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  createProfessional(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ProfessionalDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfessionalView> {
    return this.professionals.createProfessional(actor, id, defined(body), meta);
  }

  @Patch('professionals/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  updateProfessional(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateProfessionalDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ProfessionalView> {
    const { fullName, profession, publicContact, status, ...rest } = body;

    return this.professionals.updateProfessional(
      actor,
      id,
      {
        ...defined({ fullName, profession, publicContact, status }),
        ...emptyToNull(defined(rest))
      },
      meta
    );
  }

  @Get('partner-services')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  listServices(@Query('partnerId') partnerId?: string): Promise<ServiceView[]> {
    return this.professionals.listServices(
      partnerId && /^[0-9a-f-]{36}$/i.test(partnerId) ? partnerId : undefined
    );
  }

  @Post('partners/:id/services')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  createService(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ServiceDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ServiceView> {
    const { price, ...rest } = body;

    return this.professionals.createService(
      actor,
      id,
      { ...defined(rest), ...(price === undefined ? {} : { price: parseMoney(price, 'price') }) },
      meta
    );
  }

  @Patch('partner-services/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  updateService(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateServiceDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ServiceView> {
    const { price, ...rest } = body;

    return this.professionals.updateService(
      actor,
      id,
      {
        ...defined(rest),
        ...(price === undefined ? {} : { price: price === '' ? null : parseMoney(price, 'price') })
      },
      meta
    );
  }

  @Put('partner-services/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  serviceStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ServiceStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<ServiceView> {
    return this.professionals.changeServiceStatus(actor, id, body.status, meta);
  }

  @Get('professionals/:id/availability')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  availability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AvailabilityQueryDto
  ): Promise<AvailabilityView[]> {
    return this.professionals.listAvailability(id, {
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {})
    });
  }

  @Post('professionals/:id/availability')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  addAvailability(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AvailabilityDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AvailabilityView> {
    return this.professionals.addAvailability(actor, id, defined(body), meta);
  }

  @Post('availability/:id/block')
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.servicesManage)
  block(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PartnerReasonDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AvailabilityView> {
    return this.professionals.blockAvailability(actor, id, body.reason, meta);
  }

  // ---------- Agendamentos (diretoria) ----------

  @Get('appointments')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.appointmentsManage)
  listAppointments(@Query() query: AppointmentQueryDto): Promise<Page<AppointmentView>> {
    return this.appointments.list(defined(query));
  }

  @Get('appointments/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.appointmentsManage)
  getAppointment(@Param('id', new ParseUUIDPipe()) id: string): Promise<AppointmentView> {
    return this.appointments.get(id);
  }

  @Put('appointments/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.appointmentsManage)
  appointmentStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AppointmentStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<AppointmentView> {
    const { status, ...rest } = body;

    return this.appointments.changeStatus(actor, id, status, defined(rest), meta);
  }

  // ---------- Repasses ----------

  @Get('settlements')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settlementsManage)
  listSettlements(@Query() query: SettlementQueryDto): Promise<Page<SettlementView>> {
    return this.settlements.list(defined(query));
  }

  @Get('settlements/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settlementsManage)
  getSettlement(@Param('id', new ParseUUIDPipe()) id: string): Promise<SettlementView> {
    return this.settlements.get(id);
  }

  @Post('partners/:id/settlements')
  @ApiBearerAuth()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.settlementsManage)
  createSettlement(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SettlementDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<SettlementView> {
    const { adjustmentAmount, ...rest } = body;

    return this.settlements.create(
      actor,
      id,
      {
        ...defined(rest),
        ...(adjustmentAmount === undefined ? {} : { adjustmentAmount: money(adjustmentAmount) })
      },
      key,
      meta
    );
  }

  @Put('settlements/:id/status')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.settlementsManage)
  settlementStatus(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SettlementStatusDto,
    @ReqMeta() meta: RequestMeta
  ): Promise<SettlementView> {
    return this.settlements.changeStatus(actor, id, body.status, body.reason, meta);
  }

  @Post('settlements/:id/pay')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiHeader(IDEMPOTENCY_HEADER)
  @RequirePermissions(PERMISSIONS.settlementsManage)
  pay(
    @CurrentPrincipal() actor: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SettlementPayDto,
    @IdempotencyKey() key: string,
    @ReqMeta() meta: RequestMeta
  ): Promise<SettlementView> {
    return this.settlements.pay(actor, id, defined(body), key, meta);
  }
}
