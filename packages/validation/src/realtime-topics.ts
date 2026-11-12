/**
 * Assuntos do tempo real (DT-116). Cada mudança gravada no banco avisa o assunto que mudou;
 * cada tela declara, pelo caminho que consulta na API, os assuntos que mostra. O aviso não
 * leva dados: a tela busca de novo, com as permissões de quem está vendo.
 *
 * Fica no pacote compartilhado para a API e o site usarem a mesma lista.
 */
export const REALTIME_TOPICS = [
  'users',
  'athletes',
  'teams',
  'registrations',
  'tryouts',
  'fees',
  'payments',
  'finance',
  'store',
  'coupons',
  'campaigns',
  'orders',
  'delivery',
  'cards',
  'benefits',
  'partners',
  'appointments',
  'settlements',
  'news',
  'events',
  'forum',
  'settings',
  'accountability',
  'privacy',
  'audit',
  'notifications'
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

const TOPIC_SET: ReadonlySet<string> = new Set(REALTIME_TOPICS);

export function isRealtimeTopic(value: unknown): value is RealtimeTopic {
  return typeof value === 'string' && TOPIC_SET.has(value);
}

/**
 * Assuntos públicos: chegam a todos, inclusive visitantes sem login. A API confere, por teste,
 * que são exatamente os que ela libera para todos (`TOPIC_ACCESS`).
 */
export const PUBLIC_TOPIC_NAMES: readonly RealtimeTopic[] = [
  'teams',
  'tryouts',
  'store',
  'campaigns',
  'benefits',
  'partners',
  'news',
  'events',
  'forum',
  'settings'
];

/** A tela que consulta `path` mostra algum assunto público? */
export function showsPublicTopic(path: string): boolean {
  return topicsOfPath(path).some((topic) => PUBLIC_TOPIC_NAMES.includes(topic));
}

/** Indicadores do painel e relatórios: somam quase tudo. */
const INDICATORS: readonly RealtimeTopic[] = [
  'orders',
  'payments',
  'fees',
  'finance',
  'athletes',
  'registrations',
  'store',
  'campaigns',
  'settlements',
  'cards',
  'partners',
  'appointments',
  'forum',
  'privacy'
];

/**
 * Caminho da API (sem `/api/v1` e sem a consulta) → assuntos que a tela mostra. Vale a soma
 * de todas as regras que casam. Uma mudança de pagamento, por exemplo, atualiza o pedido, a
 * mensalidade, o Caixa e o painel, porque todos dependem de `payments`.
 */
const PATH_TOPICS: readonly (readonly [RegExp, readonly RealtimeTopic[]])[] = [
  // Área da própria pessoa.
  [/^\/me$/, ['users', 'athletes']],
  [/^\/me\/athlete$/, ['athletes', 'teams', 'fees']],
  [/^\/me\/orders(\/|$)/, ['orders', 'payments', 'delivery']],
  [/^\/me\/monthly-fees(\/|$)/, ['fees', 'payments']],
  [/^\/me\/(pix|card)\//, ['payments']],
  [/^\/me\/cards(\/|$)/, ['cards', 'settings']],
  [/^\/me\/tryout-registrations$/, ['registrations', 'tryouts']],
  [/^\/me\/appointments$/, ['appointments', 'partners']],
  [/^\/me\/privacy\//, ['privacy']],
  [/^\/me\/(favorites|stock-alerts|reviews)(\/|$)/, ['store']],
  [/^\/forum\/me\/standing$/, ['forum']],

  // Painel administrativo.
  [/^\/dashboard\//, INDICATORS],
  [/^\/reports(\/|$)/, INDICATORS],
  [/^\/(users|roles|permissions)(\/|$)/, ['users']],
  [/^\/audit-logs(\/|$)/, ['audit']],
  [/^\/athletes(\/|$)/, ['athletes', 'teams', 'fees', 'cards', 'users']],
  [/^\/(teams|sport-categories)(\/|$)/, ['teams', 'athletes']],
  [/^\/interested-people(\/|$)/, ['registrations', 'settings']],
  [/^\/tryouts(\/|$)/, ['tryouts', 'registrations']],
  [/^\/fee-plans(\/|$)/, ['fees', 'athletes']],
  [/^\/monthly-fees(\/|$)/, ['fees', 'payments', 'athletes']],
  [/^\/finance\//, ['finance', 'payments']],
  [/^\/payments\//, ['payments', 'finance', 'settings']],
  [/^\/store\/orders(\/|$)/, ['orders', 'payments', 'delivery']],
  [/^\/store\/returns(\/|$)/, ['orders', 'payments']],
  [/^\/store\/(products|categories|variants|reviews|personalization-fields)(\/|$)/, ['store']],
  [/^\/store\/coupons(\/|$)/, ['coupons', 'store']],
  [/^\/store\/(couriers|delivery)(\/|$)/, ['delivery', 'settings']],
  [/^\/campaigns(\/|$)/, ['campaigns', 'store', 'orders']],
  [/^\/cards(\/|$)/, ['cards', 'athletes', 'settings']],
  [/^\/partner-benefits(\/|$)/, ['benefits', 'partners']],
  [/^\/partners\/sales-report$/, ['orders', 'payments', 'settlements']],
  [/^\/partners(\/|$)/, ['partners', 'settlements', 'store']],
  [/^\/(partner-services|professionals|availability)(\/|$)/, ['partners', 'appointments']],
  [/^\/appointments(\/|$)/, ['appointments']],
  [/^\/settlements(\/|$)/, ['settlements', 'orders']],
  [/^\/(news|news-categories|news-tags)(\/|$)/, ['news', 'events']],
  [/^\/events(\/|$)/, ['events']],
  [/^\/forum\//, ['forum']],
  [/^\/notifications\//, ['notifications']],
  [/^\/team-settings(\/|$)/, ['settings']],
  [/^\/accountability-reports(\/|$)/, ['accountability', 'finance']],
  [/^\/privacy-requests(\/|$)/, ['privacy']],
  [/^\/cart$/, ['store', 'coupons', 'campaigns']],

  // Site público.
  [/^\/public\/(news|news-categories|news-tags|news-most-read)(\/|$)/, ['news']],
  [/^\/public\/events(\/|$)/, ['events']],
  [/^\/public\/(teams|teams-roster|categories)(\/|$)/, ['teams']],
  [/^\/public\/tryouts(\/|$)/, ['tryouts']],
  [/^\/public\/(products|product-categories)(\/|$)/, ['store', 'campaigns']],
  [/^\/public\/campaigns(\/|$)/, ['campaigns', 'store']],
  [/^\/public\/(partners|partner-services)(\/|$)/, ['partners', 'appointments']],
  [/^\/public\/benefits$/, ['benefits', 'partners']],
  [/^\/public\/(team|delivery|pix|card)$/, ['settings', 'delivery']],
  [/^\/public\/deliveries\//, ['orders', 'delivery']]
];

/** Assuntos que uma tela que consulta `path` mostra (vazio = não muda sozinha). */
export function topicsOfPath(path: string): RealtimeTopic[] {
  const bare = path.split('?')[0] ?? '';
  const found = new Set<RealtimeTopic>();

  for (const [pattern, topics] of PATH_TOPICS) {
    if (pattern.test(bare)) {
      topics.forEach((topic) => found.add(topic));
    }
  }

  return [...found];
}
