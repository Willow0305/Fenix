export const ROLE_CODES = {
  administrator: 'ADMIN',
  board: 'BOARD',
  finance: 'FINANCE',
  financeAssistant: 'FINANCE_ASSISTANT',
  treasurer: 'TREASURER',
  user: 'USER'
} as const;

export const PERMISSION_CODES = {
  athletesCreate: 'athletes.create',
  athletesRead: 'athletes.read',
  athletesUpdate: 'athletes.update',
  auditRead: 'audit.read',
  categoriesManage: 'categories.manage',
  financeCashClose: 'finance.cash.close',
  financeCashOperate: 'finance.cash.operate',
  financeCatalogsManage: 'finance.catalogs.manage',
  financeChargesManage: 'finance.charges.manage',
  financeEntriesApprove: 'finance.entries.approve',
  financeEntriesCreate: 'finance.entries.create',
  financeObligationsManage: 'finance.obligations.manage',
  financePaymentsReconcile: 'finance.payments.reconcile',
  financePaymentsRecord: 'finance.payments.record',
  financePlansManage: 'finance.plans.manage',
  financeRead: 'finance.read',
  financeReverse: 'finance.reverse',
  financeTransfersManage: 'finance.transfers.manage',
  guardiansManage: 'guardians.manage',
  mfaManage: 'mfa.manage',
  permissionsManage: 'permissions.manage',
  privacyRequestsManage: 'privacy.requests.manage',
  registrationsConvert: 'registrations.convert',
  registrationsRead: 'registrations.read',
  registrationsReview: 'registrations.review',
  retentionExecute: 'retention.execute',
  rolesAssign: 'roles.assign',
  sessionsRevoke: 'sessions.revoke',
  sportsRead: 'sports.read',
  teamsAssign: 'teams.assign',
  teamsManage: 'teams.manage',
  tryoutsManage: 'tryouts.manage',
  usersCreate: 'users.create',
  usersRead: 'users.read',
  usersUpdate: 'users.update'
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export interface CatalogRole {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
}

export const PHASE_ONE_PERMISSIONS = [
  {
    code: PERMISSION_CODES.usersRead,
    name: 'Consultar usuários',
    description: 'Consulta a lista administrativa mínima de contas.'
  },
  {
    code: PERMISSION_CODES.usersCreate,
    name: 'Criar usuários',
    description: 'Cria somente contas comuns sem privilégio implícito.'
  },
  {
    code: PERMISSION_CODES.usersUpdate,
    name: 'Alterar usuários',
    description: 'Altera nome e estado de contas da Fase 1.'
  },
  {
    code: PERMISSION_CODES.rolesAssign,
    name: 'Atribuir papéis',
    description: 'Concede ou revoga papéis explicitamente.'
  },
  {
    code: PERMISSION_CODES.permissionsManage,
    name: 'Gerenciar permissões',
    description: 'Configura permissões dos papéis não protegidos.'
  },
  {
    code: PERMISSION_CODES.sessionsRevoke,
    name: 'Revogar sessões',
    description: 'Revoga sessões ativas de uma conta.'
  },
  {
    code: PERMISSION_CODES.auditRead,
    name: 'Consultar auditoria',
    description: 'Consulta a trilha administrativa minimizada.'
  },
  {
    code: PERMISSION_CODES.mfaManage,
    name: 'Recuperar MFA administrativamente',
    description: 'Redefine MFA com salvaguarda do último administrador seguro.'
  },
  {
    code: PERMISSION_CODES.privacyRequestsManage,
    name: 'Gerenciar solicitações de privacidade',
    description: 'Registra e acompanha solicitações de titulares.'
  },
  {
    code: PERMISSION_CODES.retentionExecute,
    name: 'Executar retenção',
    description: 'Executa rotina rastreável de retenção e anonimização.'
  }
] as const;

const allPhaseOnePermissions = PHASE_ONE_PERMISSIONS.map(({ code }) => code);

export const PHASE_TWO_PERMISSIONS = [
  {
    code: PERMISSION_CODES.sportsRead,
    name: 'Consultar módulo esportivo',
    description: 'Consulta o painel e os catálogos esportivos autorizados.'
  },
  {
    code: PERMISSION_CODES.categoriesManage,
    name: 'Gerenciar categorias esportivas',
    description: 'Cria e atualiza categorias sem reescrever o histórico.'
  },
  {
    code: PERMISSION_CODES.teamsManage,
    name: 'Gerenciar equipes',
    description: 'Cria e atualiza equipes e seus vínculos de categoria.'
  },
  {
    code: PERMISSION_CODES.athletesRead,
    name: 'Consultar atletas',
    description: 'Consulta cadastros esportivos minimizados.'
  },
  {
    code: PERMISSION_CODES.athletesCreate,
    name: 'Criar atletas',
    description: 'Cria cadastro esportivo separado da conta de acesso.'
  },
  {
    code: PERMISSION_CODES.athletesUpdate,
    name: 'Atualizar atletas',
    description: 'Atualiza dados esportivos permitidos com auditoria.'
  },
  {
    code: PERMISSION_CODES.teamsAssign,
    name: 'Vincular atletas',
    description: 'Mantém o histórico de equipe e categoria do atleta.'
  },
  {
    code: PERMISSION_CODES.guardiansManage,
    name: 'Gerenciar responsáveis',
    description: 'Registra responsáveis e autorizações protegidas para dados fictícios.'
  },
  {
    code: PERMISSION_CODES.tryoutsManage,
    name: 'Gerenciar seletivas',
    description: 'Cria e mantém seletivas dentro da máquina de estados autorizada.'
  },
  {
    code: PERMISSION_CODES.registrationsRead,
    name: 'Consultar inscrições',
    description: 'Consulta inscrições e seu histórico de estados.'
  },
  {
    code: PERMISSION_CODES.registrationsReview,
    name: 'Analisar inscrições',
    description: 'Registra presença, espera e resultado sem apagar o histórico.'
  },
  {
    code: PERMISSION_CODES.registrationsConvert,
    name: 'Converter inscrição em atleta',
    description: 'Converte aprovação em atleta por transação auditada.'
  }
] as const;

export const PHASE_THREE_PERMISSIONS = [
  {
    code: PERMISSION_CODES.financeRead,
    name: 'Consultar Caixa Fênix',
    description: 'Consulta catálogos, cobranças e razão financeiro administrativo.'
  },
  {
    code: PERMISSION_CODES.financeCatalogsManage,
    name: 'Gerenciar catálogos financeiros',
    description: 'Cria contas financeiras, categorias e centros de custo.'
  },
  {
    code: PERMISSION_CODES.financePlansManage,
    name: 'Gerenciar planos e versões',
    description: 'Cria planos e novas versões imutáveis de valores e regras.'
  },
  {
    code: PERMISSION_CODES.financeChargesManage,
    name: 'Gerenciar cobranças',
    description: 'Cria cobranças por competência preservando o valor original.'
  },
  {
    code: PERMISSION_CODES.financePaymentsRecord,
    name: 'Registrar pagamentos',
    description: 'Registra pagamentos pendentes com idempotência.'
  },
  {
    code: PERMISSION_CODES.financePaymentsReconcile,
    name: 'Conciliar pagamentos',
    description: 'Aloca pagamentos em cobranças e trata excedentes explicitamente.'
  },
  {
    code: PERMISSION_CODES.financeEntriesCreate,
    name: 'Criar lançamentos pendentes',
    description: 'Registra lançamentos para posterior decisão do tesoureiro.'
  },
  {
    code: PERMISSION_CODES.financeEntriesApprove,
    name: 'Aprovar lançamentos',
    description: 'Aprova ou rejeita lançamentos financeiros pendentes.'
  },
  {
    code: PERMISSION_CODES.financeReverse,
    name: 'Reverter movimentações',
    description: 'Cria correções auditáveis sem editar a movimentação aprovada.'
  },
  {
    code: PERMISSION_CODES.financeTransfersManage,
    name: 'Gerenciar transferências',
    description: 'Cria e decide transferências neutras entre contas.'
  },
  {
    code: PERMISSION_CODES.financeObligationsManage,
    name: 'Gerenciar contas a pagar e receber',
    description: 'Registra obrigações e recebíveis sem apagar o histórico.'
  },
  {
    code: PERMISSION_CODES.financeCashOperate,
    name: 'Operar Caixa Fênix',
    description: 'Abre sessões de caixa e consulta seus movimentos.'
  },
  {
    code: PERMISSION_CODES.financeCashClose,
    name: 'Fechar Caixa Fênix',
    description: 'Fecha o caixa com saldos calculados e contagem registrada.'
  }
] as const;

export const CURRENT_PERMISSIONS = [
  ...PHASE_ONE_PERMISSIONS,
  ...PHASE_TWO_PERMISSIONS,
  ...PHASE_THREE_PERMISSIONS
] as const;
const allPhaseTwoPermissions = PHASE_TWO_PERMISSIONS.map(({ code }) => code);
const allPhaseThreePermissions = PHASE_THREE_PERMISSIONS.map(({ code }) => code);
const financeOperationalPermissions = [
  PERMISSION_CODES.financeRead,
  PERMISSION_CODES.financeCatalogsManage,
  PERMISSION_CODES.financePlansManage,
  PERMISSION_CODES.financeChargesManage,
  PERMISSION_CODES.financePaymentsRecord,
  PERMISSION_CODES.financeEntriesCreate,
  PERMISSION_CODES.financeObligationsManage
] as const;

export const CURRENT_ROLES: readonly CatalogRole[] = [
  {
    code: ROLE_CODES.administrator,
    name: 'Administrador',
    description: 'Governança técnica e de acesso da Fase 1.',
    permissions: allPhaseOnePermissions
  },
  {
    code: ROLE_CODES.board,
    name: 'Diretoria',
    description: 'Operação esportiva e consulta administrativa conforme permissões.',
    permissions: [PERMISSION_CODES.usersRead, PERMISSION_CODES.auditRead, ...allPhaseTwoPermissions]
  },
  {
    code: ROLE_CODES.finance,
    name: 'Financeiro',
    description: 'Operação financeira com lançamentos sempre sujeitos à decisão do tesoureiro.',
    permissions: financeOperationalPermissions
  },
  {
    code: ROLE_CODES.financeAssistant,
    name: 'Assistente financeiro',
    description: 'Registra catálogos, cobranças, pagamentos e lançamentos pendentes.',
    permissions: financeOperationalPermissions
  },
  {
    code: ROLE_CODES.treasurer,
    name: 'Tesoureiro',
    description: 'Decide, reverte, concilia e fecha o Caixa Fênix.',
    permissions: allPhaseThreePermissions
  },
  {
    code: ROLE_CODES.user,
    name: 'Usuário comum',
    description: 'Conta sem acesso administrativo.',
    permissions: []
  }
];

export const PHASE_ONE_ROLES = CURRENT_ROLES;
