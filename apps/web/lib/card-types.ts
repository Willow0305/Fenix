import type { MoneyView } from './finance-types';
import type { ProductStatus } from './store-types';

/** Carteirinha digital (DT-068); diretoria gratuita (DT-077). */
export type CardType = 'ATHLETE' | 'AFFILIATE' | 'BOARD';
export type CardTemplate = 'CLASSIC' | 'LIGHT' | 'STRIPE';
export type CardState =
  | 'VALID'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'ATHLETE_INACTIVE'
  | 'BOARD_INACTIVE'
  | 'REPLACED';

export const CARD_TYPE: Record<CardType, string> = {
  ATHLETE: 'Atleta',
  AFFILIATE: 'Afiliado',
  BOARD: 'Diretoria'
};

export const CARD_TEMPLATES: { value: CardTemplate; label: string }[] = [
  { value: 'CLASSIC', label: 'Clássico (escuro e vermelho)' },
  { value: 'LIGHT', label: 'Claro' },
  { value: 'STRIPE', label: 'Faixa' }
];

/** Públicos do benefício (DT-077), na ordem em que aparecem. */
export const BENEFIT_AUDIENCES = [
  { key: 'forBoard', label: 'Diretoria', card: 'BOARD' },
  { key: 'forAthletes', label: 'Atletas', card: 'ATHLETE' },
  { key: 'forAffiliates', label: 'Afiliados', card: 'AFFILIATE' }
] as const;

export type AudienceKey = (typeof BENEFIT_AUDIENCES)[number]['key'];

/** "Diretoria, atletas e afiliados" a partir dos públicos marcados. */
export function audienceLabel(benefit: Record<AudienceKey, boolean>): string {
  const names = BENEFIT_AUDIENCES.filter((a) => benefit[a.key]).map((a, index) =>
    index === 0 ? a.label : a.label.toLowerCase()
  );

  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
    : (names[0] ?? '—');
}

export interface CardDesign {
  template: CardTemplate;
  useTeamLogo: boolean;
  teamName: string;
  officialLogoUrl: string | null;
  backgroundUrl: string | null;
}

export interface Benefit {
  id: string;
  /** `id` nulo: parceiro sem cadastro no site, só nome e contato (DT-074). */
  partner: { id: string | null; name: string; logoUrl: string | null; details: string | null };
  title: string;
  discountPercent: string;
  conditions: string | null;
  forBoard: boolean;
  forAthletes: boolean;
  forAffiliates: boolean;
}

export interface BenefitAdmin extends Benefit {
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  inEffect: boolean;
}

export interface MemberCard {
  id: string;
  code: string;
  type: CardType;
  state: CardState;
  stateLabel: string;
  holderName: string;
  startsOn: string | null;
  endsOn: string | null;
  photo: string | null;
  team: { name: string; logoUrl: string | null } | null;
  purchasedForOther: boolean;
  benefits: Benefit[];
}

export interface CardQr {
  qrSvg: string;
  validUntil: string | null;
  refreshInMs: number | null;
}

export interface PublicValidation {
  valid: boolean;
  label: string;
  checkedAt: string;
  card: {
    type: CardType;
    name: string;
    photo: string | null;
    minorWithoutPhoto: boolean;
    endsOn: string | null;
    benefits: Benefit[];
  } | null;
}

export interface StaffValidation {
  valid: boolean;
  state: CardState | 'UNKNOWN';
  label: string;
  checkedAt: string;
  card: (MemberCard & { feesUpToDate: boolean | null; athleteStatus: string | null }) | null;
}

export interface CardAdminRow {
  id: string;
  code: string;
  type: CardType;
  state: CardState;
  stateLabel: string;
  holderName: string;
  holderEmail: string | null;
  hasAccount: boolean;
  startsOn: string | null;
  endsOn: string | null;
  version: number;
  statusReason: string | null;
  /** Plano de afiliação comprado; nulo na de atleta. */
  plan: string | null;
}

/** Plano de afiliação (produto da loja do tipo afiliação) na aba Afiliação (DT-072). */
export interface MembershipPlanRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  price: MoneyView;
  promotionalPrice: MoneyView | null;
  membershipMonths: number | null;
  availableFrom: string | null;
  availableUntil: string | null;
  announcedAt: string | null;
  activeCards: number;
  issuedCards: number;
}

export interface CardsOverview {
  athletes: { valid: number };
  board: { valid: number };
  affiliates: { valid: number; suspended: number; expiringSoon: number; expired: number };
  benefits: {
    inEffect: number;
    total: number;
    athlete: number;
    affiliate: number;
    board: number;
  };
  plans: MembershipPlanRow[];
}

export interface CardAdminDetail extends CardAdminRow {
  checks: {
    checkedAt: string;
    valid: boolean;
    reason: string | null;
    byStaff: boolean;
    printed: boolean;
  }[];
}

export interface MyCards {
  design: CardDesign;
  cards: MemberCard[];
}
