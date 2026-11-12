import { REALTIME_TOPICS, type RealtimeTopic } from '@fenix/validation';

import { PERMISSIONS, type PermissionCode } from '../../access/domain/permission-catalog';

/**
 * Quem recebe o aviso de cada assunto (DT-116). O aviso não leva dados, mas segue o
 * privilégio mínimo: assunto do painel só vai para quem tem uma das permissões de leitura
 * daquela área (ou de agir nela); assunto público vai para todos, inclusive visitantes sem
 * login. O teste de integração confere que toda tela do painel recebe o assunto dela.
 */
type TopicAccess = { readonly public: true } | { readonly anyOf: readonly PermissionCode[] };

export const TOPIC_ACCESS: Readonly<Record<RealtimeTopic, TopicAccess>> = {
  users: { anyOf: [PERMISSIONS.usersRead, PERMISSIONS.rolesAssign, PERMISSIONS.permissionsManage] },
  athletes: { anyOf: [PERMISSIONS.athletesRead] },
  teams: { public: true },
  registrations: { anyOf: [PERMISSIONS.registrationsRead, PERMISSIONS.tryoutsManage] },
  tryouts: { public: true },
  fees: {
    anyOf: [
      PERMISSIONS.feesRead,
      PERMISSIONS.feesManagePlans,
      PERMISSIONS.feesGenerate,
      PERMISSIONS.feesAdjust
    ]
  },
  payments: {
    anyOf: [
      PERMISSIONS.paymentsRecord,
      PERMISSIONS.paymentsConfirm,
      PERMISSIONS.paymentsCorrect,
      PERMISSIONS.ordersRead,
      PERMISSIONS.feesRead,
      PERMISSIONS.financeRead
    ]
  },
  finance: {
    anyOf: [
      PERMISSIONS.financeRead,
      PERMISSIONS.financeSetup,
      PERMISSIONS.transactionsCreate,
      PERMISSIONS.transactionsConfirm,
      PERMISSIONS.transactionsCancel,
      PERMISSIONS.cashReconcile,
      PERMISSIONS.cashClose,
      PERMISSIONS.cashReopen
    ]
  },
  store: { public: true },
  coupons: { anyOf: [PERMISSIONS.couponsManage] },
  campaigns: { public: true },
  orders: { anyOf: [PERMISSIONS.ordersRead, PERMISSIONS.settlementsManage] },
  delivery: { anyOf: [PERMISSIONS.deliveryManage, PERMISSIONS.ordersRead] },
  cards: { anyOf: [PERMISSIONS.cardsRead, PERMISSIONS.cardsManage] },
  benefits: { public: true },
  partners: { public: true },
  appointments: { anyOf: [PERMISSIONS.appointmentsManage, PERMISSIONS.servicesManage] },
  settlements: { anyOf: [PERMISSIONS.settlementsManage] },
  news: { public: true },
  events: { public: true },
  forum: { public: true },
  settings: { public: true },
  accountability: { anyOf: [PERMISSIONS.accountabilityRead] },
  privacy: { anyOf: [PERMISSIONS.privacyRequestsManage] },
  audit: { anyOf: [PERMISSIONS.auditRead] },
  notifications: { anyOf: [PERMISSIONS.notificationsSend] }
};

export const PUBLIC_REALTIME_TOPICS: readonly RealtimeTopic[] = REALTIME_TOPICS.filter(
  (topic) => 'public' in TOPIC_ACCESS[topic]
);

/** Assuntos que quem tem `permissions` pode receber; sem permissões, só os públicos. */
export function visibleTopics(permissions: ReadonlySet<string>): Set<RealtimeTopic> {
  return new Set(
    REALTIME_TOPICS.filter((topic) => {
      const access = TOPIC_ACCESS[topic];

      return 'public' in access || access.anyOf.some((code) => permissions.has(code));
    })
  );
}
