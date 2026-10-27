/**
 * Catálogo de permissões e papéis de sistema (05-PERFIS-E-PERMISSOES.md, DT-022).
 * A sincronização com o banco é idempotente (`npm run db:seed`). Papéis são agrupadores;
 * o código da aplicação verifica sempre permissões, nunca nomes de papéis.
 */
export const PERMISSIONS = {
  usersRead: 'users.read',
  usersCreate: 'users.create',
  usersUpdate: 'users.update',
  rolesAssign: 'roles.assign',
  permissionsManage: 'permissions.manage',
  sessionsRevoke: 'sessions.revoke',

  athletesRead: 'athletes.read',
  athletesCreate: 'athletes.create',
  athletesUpdate: 'athletes.update',
  athletesStatusChange: 'athletes.status.change',
  teamsAssign: 'teams.assign',
  teamsManage: 'teams.manage',

  registrationsRead: 'registrations.read',
  registrationsReview: 'registrations.review',
  tryoutsManage: 'tryouts.manage',

  feesRead: 'fees.read',
  feesManagePlans: 'fees.plans.manage',
  feesGenerate: 'fees.generate',
  feesAdjust: 'fees.adjust',
  paymentsRecord: 'payments.record',
  paymentsConfirm: 'payments.confirm',
  paymentsCorrect: 'payments.correct',

  financeRead: 'finance.read',
  financeSetup: 'finance.setup',
  transactionsCreate: 'transactions.create',
  transactionsConfirm: 'transactions.confirm',
  transactionsCancel: 'transactions.cancel',
  refundsCreate: 'refunds.create',
  cashReconcile: 'cash.reconcile',
  cashClose: 'cash.close',
  cashReopen: 'cash.reopen',

  filesUpload: 'files.upload',
  filesReadRestricted: 'files.read.restricted',
  filesDeleteLogical: 'files.delete.logical',

  productsManage: 'products.manage',
  inventoryAdjust: 'inventory.adjust',
  ordersRead: 'orders.read',
  ordersStatusChange: 'orders.status.change',
  campaignsManage: 'campaigns.manage',
  couponsManage: 'coupons.manage',

  partnersManage: 'partners.manage',
  partnerDocumentsRead: 'partner.documents.read',
  servicesManage: 'services.manage',
  appointmentsManage: 'appointments.manage',
  settlementsManage: 'settlements.manage',

  forumPublish: 'forum.publish',
  forumModerate: 'forum.moderate',
  forumMembersAccess: 'forum.members.access',
  newsManage: 'news.manage',
  eventsManage: 'events.manage',
  notificationsSend: 'notifications.send',

  settingsPublicManage: 'settings.public.manage',
  settingsFinancialManage: 'settings.financial.manage',
  logosManage: 'logos.manage',
  cardsRead: 'cards.read',
  cardsManage: 'cards.manage',
  benefitsManage: 'benefits.manage',

  dashboardRead: 'dashboard.read',
  reportsRead: 'reports.read',
  reportsExport: 'reports.export',
  auditRead: 'audit.read',
  privacyRequestsManage: 'privacy.requests.manage'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly PermissionCode[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  'users.read': 'Consultar usuários',
  'users.create': 'Criar usuários',
  'users.update': 'Alterar usuários',
  'roles.assign': 'Atribuir papéis',
  'permissions.manage': 'Gerenciar permissões dos papéis',
  'sessions.revoke': 'Revogar sessões de usuários',
  'athletes.read': 'Consultar atletas',
  'athletes.create': 'Cadastrar atletas',
  'athletes.update': 'Editar atletas',
  'athletes.status.change': 'Alterar status de atletas',
  'teams.assign': 'Vincular atletas a equipes',
  'teams.manage': 'Gerenciar equipes e categorias',
  'registrations.read': 'Consultar interessados e inscrições',
  'registrations.review': 'Analisar inscrições',
  'tryouts.manage': 'Gerenciar seletivas',
  'fees.read': 'Consultar mensalidades',
  'fees.plans.manage': 'Gerenciar planos de mensalidade',
  'fees.generate': 'Gerar mensalidades',
  'fees.adjust': 'Ajustar ou cancelar mensalidades',
  'payments.record': 'Registrar pagamentos',
  'payments.confirm': 'Confirmar pagamentos',
  'payments.correct': 'Estornar ou corrigir pagamentos',
  'finance.read': 'Consultar o Caixa Fênix',
  'finance.setup': 'Configurar contas, categorias e centros de custo',
  'transactions.create': 'Criar lançamentos financeiros',
  'transactions.confirm': 'Confirmar lançamentos financeiros',
  'transactions.cancel': 'Cancelar ou estornar lançamentos',
  'refunds.create': 'Registrar reembolsos',
  'cash.reconcile': 'Conciliar contas',
  'cash.close': 'Fechar caixa',
  'cash.reopen': 'Reabrir fechamento de caixa',
  'files.upload': 'Enviar arquivos administrativos',
  'files.read.restricted': 'Ler arquivos restritos',
  'files.delete.logical': 'Remover arquivos logicamente',
  'products.manage': 'Gerenciar produtos',
  'inventory.adjust': 'Ajustar estoque',
  'orders.read': 'Consultar pedidos',
  'orders.status.change': 'Alterar status de pedidos',
  'campaigns.manage': 'Gerenciar remessas/campanhas',
  'coupons.manage': 'Gerenciar cupons de desconto',
  'partners.manage': 'Gerenciar parceiros',
  'partner.documents.read': 'Ler documentos de parceiros',
  'services.manage': 'Gerenciar profissionais e serviços',
  'appointments.manage': 'Gerenciar agendamentos',
  'settlements.manage': 'Gerenciar repasses',
  'forum.publish': 'Publicar comunicados no fórum',
  'forum.moderate': 'Moderar fórum',
  'forum.members.access': 'Acessar a área de membros do fórum',
  'news.manage': 'Gerenciar notícias',
  'events.manage': 'Gerenciar eventos e partidas',
  'notifications.send': 'Enviar notificações',
  'settings.public.manage': 'Editar dados públicos do time',
  'settings.financial.manage': 'Editar PIX e dados bancários',
  'logos.manage': 'Gerenciar logos',
  'cards.read': 'Conferir carteirinhas',
  'cards.manage': 'Gerenciar carteirinhas',
  'benefits.manage': 'Gerenciar benefícios de parceiros',
  'dashboard.read': 'Ver painel administrativo',
  'reports.read': 'Consultar relatórios',
  'reports.export': 'Exportar relatórios',
  'audit.read': 'Consultar auditoria',
  'privacy.requests.manage': 'Atender solicitações de titulares'
};

export const SYSTEM_ROLES = {
  admin: 'admin',
  board: 'board',
  athlete: 'athlete',
  user: 'user'
} as const;

export type SystemRoleCode = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

const GOVERNANCE_ONLY: ReadonlySet<PermissionCode> = new Set<PermissionCode>([
  'users.create',
  'roles.assign',
  'permissions.manage',
  'sessions.revoke',
  'settings.public.manage',
  'settings.financial.manage',
  'audit.read',
  'privacy.requests.manage'
]);

export interface SystemRoleDefinition {
  readonly code: SystemRoleCode;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
}

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    code: 'admin',
    name: 'Administrador',
    description: 'Governança técnica, usuários, papéis, configurações e todas as operações.',
    permissions: ALL_PERMISSIONS
  },
  {
    code: 'board',
    name: 'Diretoria',
    description: 'Operações esportivas, financeiras, loja, parceiros e comunicação.',
    permissions: ALL_PERMISSIONS.filter((code) => !GOVERNANCE_ONLY.has(code))
  },
  {
    code: 'athlete',
    name: 'Atleta',
    description:
      'Acesso aos próprios dados, mensalidades, pedidos, inscrições e área de membros do fórum.',
    permissions: ['forum.members.access']
  },
  {
    code: 'user',
    name: 'Usuário',
    description: 'Conta cadastrada: loja, favoritos, notificações e fórum conforme visibilidade.',
    permissions: []
  }
];

export function isPermissionCode(value: string): value is PermissionCode {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
