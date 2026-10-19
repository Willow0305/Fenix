import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS } from '../access/domain/permission-catalog';
import { RequirePermissions } from '../auth/http/auth.decorators';

export interface DashboardIndicator {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** Definição explícita do indicador (RF-020: origem rastreável). */
  readonly definition: string;
  readonly link: string;
}

/**
 * Indicadores do painel (RF-020). Cada indicador declara sua definição e aponta para a
 * listagem de origem, permitindo conferir o total.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<DashboardIndicator[]> {
    const [activeAthletes, newTryoutRegistrations, newInterested, openTryouts] =
      await this.prisma.$transaction([
        this.prisma.athlete.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.tryoutRegistration.count({ where: { status: 'NEW', deletedAt: null } }),
        this.prisma.interestedPerson.count({ where: { status: 'NEW', deletedAt: null } }),
        this.prisma.tryout.count({ where: { status: 'OPEN', deletedAt: null } })
      ]);

    return [
      {
        key: 'activeAthletes',
        label: 'Atletas ativos',
        value: String(activeAthletes),
        definition: 'Atletas com status Ativo, não excluídos.',
        link: '/admin/atletas?status=ACTIVE'
      },
      {
        key: 'newRegistrations',
        label: 'Inscrições novas',
        value: String(newTryoutRegistrations + newInterested),
        definition:
          'Inscrições em seletivas e interessados com status Nova/Novo, ainda não analisados.',
        link: '/admin/seletivas'
      },
      {
        key: 'openTryouts',
        label: 'Seletivas abertas',
        value: String(openTryouts),
        definition: 'Seletivas com status Inscrições abertas.',
        link: '/admin/seletivas'
      }
    ];
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.dashboardRead)
  summary(): Promise<DashboardIndicator[]> {
    return this.dashboard.summary();
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
