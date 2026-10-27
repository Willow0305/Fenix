import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';

import { todayIn } from '../../common/domain/civil-date';
import { CurrentPrincipal, type Principal } from '../../common/http/request-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PERMISSIONS } from '../access/domain/permission-catalog';
import { RequirePermissions } from '../auth/http/auth.decorators';
import { FinanceReportsService } from '../finance/application/finance-reports.service';
import { FinanceModule } from '../finance/finance.module';
import { OrdersService } from '../store/application/orders.service';
import { StoreModule } from '../store/store.module';
import { endOfDayExclusive, startOfDayInZone } from '../../common/domain/time-zone';

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
/**
 * Inscrições novas que ainda dá para analisar: só de seletivas não apagadas e em andamento.
 * Inscrição de seletiva apagada, cancelada ou concluída não aparece na tela de Seletivas e
 * não pode virar pendência.
 */
const NEW_REGISTRATIONS = {
  status: 'NEW',
  deletedAt: null,
  tryout: { deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
} satisfies Prisma.TryoutRegistrationWhereInput;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: FinanceReportsService,
    private readonly orders: OrdersService
  ) {}

  async summary(principal: Principal): Promise<DashboardIndicator[]> {
    const [activeAthletes, newTryoutRegistrations, newInterested, openTryouts] =
      await this.prisma.$transaction([
        this.prisma.athlete.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.tryoutRegistration.count({ where: NEW_REGISTRATIONS }),
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

    if (principal.permissions.has(PERMISSIONS.ordersRead)) {
      const today = todayIn();
      const sales = await this.orders.salesTotal(
        startOfDayInZone(`${today.slice(0, 7)}-01`),
        endOfDayExclusive(today)
      );

      indicators.push({
        key: 'monthSales',
        label: 'Vendas do mês',
        value: `R$ ${sales.amount.amount.replace('.', ',')}`,
        definition: `${sales.count} pedido(s) pago(s) no mês corrente, excluindo cancelados e reembolsados.`,
        link: '/admin/pedidos'
      });
    }

    return indicators;
  }
}

@ApiTags('Painel')
@ApiBearerAuth()
/**
 * Bolinhas do menu do painel (DT-061): contam o que espera ação da diretoria, não o que a
 * pessoa já viu. Assim todos da diretoria veem o mesmo número, e ele zera quando a tarefa
 * é feita. Cada contagem só sai para quem tem a permissão daquele módulo.
 */
@Injectable()
export class PendingBadgesService {
  constructor(private readonly prisma: PrismaService) {}

  async forPrincipal(principal: Principal): Promise<Record<string, number>> {
    const can = (permission: string) => principal.permissions.has(permission);
    const tasks: [string, () => Promise<number>][] = [];

    if (can(PERMISSIONS.ordersRead)) {
      // Comprovante de pedido a conferir + pedido pago a separar.
      tasks.push([
        '/admin/pedidos',
        async () =>
          (await this.prisma.payment.count({
            where: { status: 'PENDING', orderId: { not: null } }
          })) + (await this.prisma.order.count({ where: { status: 'PAID' } }))
      ]);
    }

    if (can(PERMISSIONS.paymentsConfirm)) {
      // PIX recebido fora do esperado, esperando a diretoria (DT-071).
      tasks.push([
        '/admin/pix',
        () => this.prisma.pixCharge.count({ where: { status: 'REVIEW' } })
      ]);
    }

    if (can(PERMISSIONS.ordersRead)) {
      // Desistência ou defeito aguardando a diretoria (DT-070).
      tasks.push([
        '/admin/devolucoes',
        () =>
          this.prisma.returnRequest.count({ where: { status: { in: ['OPEN', 'AWAITING_ITEM'] } } })
      ]);
    }

    if (can(PERMISSIONS.feesRead)) {
      tasks.push([
        '/admin/mensalidades',
        () =>
          this.prisma.payment.count({
            where: { status: 'PENDING', monthlyFeeAllocations: { some: {} } }
          })
      ]);
    }

    if (can(PERMISSIONS.registrationsRead)) {
      tasks.push([
        '/admin/interessados',
        () => this.prisma.interestedPerson.count({ where: { status: 'NEW', deletedAt: null } })
      ]);
      tasks.push([
        '/admin/seletivas',
        () => this.prisma.tryoutRegistration.count({ where: NEW_REGISTRATIONS })
      ]);
    }

    if (can(PERMISSIONS.appointmentsManage)) {
      tasks.push([
        '/admin/agendamentos',
        () => this.prisma.appointment.count({ where: { status: 'REQUESTED' } })
      ]);
    }

    if (can(PERMISSIONS.forumModerate)) {
      tasks.push([
        '/admin/forum',
        () => this.prisma.forumReport.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } })
      ]);
    }

    if (can(PERMISSIONS.privacyRequestsManage)) {
      tasks.push([
        '/admin/privacidade',
        () =>
          this.prisma.privacyRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } })
      ]);
    }

    const counts = await Promise.all(
      tasks.map(async ([href, run]) => [href, await run()] as const)
    );

    return Object.fromEntries(counts.filter(([, count]) => count > 0));
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly badges: PendingBadgesService
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.dashboardRead)
  summary(@CurrentPrincipal() principal: Principal): Promise<DashboardIndicator[]> {
    return this.dashboard.summary(principal);
  }

  /** Pendências por item do menu (DT-061); só dos módulos que a pessoa pode ver. */
  @Get('badges')
  @RequirePermissions(PERMISSIONS.dashboardRead)
  pending(@CurrentPrincipal() principal: Principal): Promise<Record<string, number>> {
    return this.badges.forPrincipal(principal);
  }
}

@Module({
  imports: [FinanceModule, StoreModule],
  controllers: [DashboardController],
  providers: [DashboardService, PendingBadgesService]
})
export class DashboardModule {}
