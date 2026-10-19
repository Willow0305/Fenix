import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { todayIn } from '../../common/domain/civil-date';
import { CurrentPrincipal, type Principal } from '../../common/http/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS } from '../access/domain/permission-catalog';
import { RequirePermissions } from '../auth/http/auth.decorators';
import { FinanceReportsService } from '../finance/application/finance-reports.service';
import { FinanceModule } from '../finance/finance.module';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: FinanceReportsService
  ) {}

  async summary(principal: Principal): Promise<DashboardIndicator[]> {
    const [activeAthletes, newTryoutRegistrations, newInterested, openTryouts] =
      await this.prisma.$transaction([
        this.prisma.athlete.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.tryoutRegistration.count({ where: { status: 'NEW', deletedAt: null } }),
        this.prisma.interestedPerson.count({ where: { status: 'NEW', deletedAt: null } }),
        this.prisma.tryout.count({ where: { status: 'OPEN', deletedAt: null } })
      ]);

    const indicators: DashboardIndicator[] = [
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

    // Indicadores financeiros só para quem pode ver finanças (restrição contextual 4).
    if (
      principal.permissions.has(PERMISSIONS.feesRead) ||
      principal.permissions.has(PERMISSIONS.financeRead)
    ) {
      const today = todayIn();
      const finance = await this.reports.summary(`${today.slice(0, 7)}-01`, today);
      const brl = (amount: string): string => `R$ ${amount.replace('.', ',')}`;

      if (principal.permissions.has(PERMISSIONS.feesRead)) {
        indicators.push({
          key: 'openFees',
          label: 'Mensalidades em aberto',
          value: String(finance.openFees.count),
          definition: `Cobranças abertas ou parciais (${finance.openFees.overdue} em atraso), somando ${brl(finance.openFees.remaining.amount)} a receber.`,
          link: '/admin/mensalidades'
        });
      }

      if (principal.permissions.has(PERMISSIONS.financeRead)) {
        indicators.push({
          key: 'cashBalance',
          label: 'Saldo em caixa',
          value: brl(finance.totalBalance.amount),
          definition:
            'Soma dos lançamentos confirmados em todas as contas (receitas menos despesas).',
          link: '/admin/caixa'
        });
      }
    }

    return indicators;
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.dashboardRead)
  summary(@CurrentPrincipal() principal: Principal): Promise<DashboardIndicator[]> {
    return this.dashboard.summary(principal);
  }
}

@Module({
  imports: [FinanceModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
