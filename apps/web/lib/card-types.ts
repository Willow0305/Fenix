/** Carteirinha digital (DT-068). */
export type CardType = 'ATHLETE' | 'AFFILIATE';
export type CardTemplate = 'CLASSIC' | 'LIGHT' | 'STRIPE';
export type CardState =
  'VALID' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED' | 'NOT_STARTED' | 'ATHLETE_INACTIVE' | 'REPLACED';
export type BenefitAudience = 'ATHLETES' | 'AFFILIATES' | 'BOTH';

export const CARD_TYPE: Record<CardType, string> = {
  ATHLETE: 'Atleta',
  AFFILIATE: 'Afiliado'
};

export const CARD_TEMPLATES: { value: CardTemplate; label: string }[] = [
  { value: 'CLASSIC', label: 'Clássico (escuro e vermelho)' },
  { value: 'LIGHT', label: 'Claro' },
  { value: 'STRIPE', label: 'Faixa' }
];

export const BENEFIT_AUDIENCE: Record<BenefitAudience, string> = {
  ATHLETES: 'Atletas',
  AFFILIATES: 'Afiliados',
  BOTH: 'Atletas e afiliados'
};

export interface CardDesign {
  template: CardTemplate;
  useTeamLogo: boolean;
  teamName: string;
  officialLogoUrl: string | null;
  backgroundUrl: string | null;
}

export interface Benefit {
  id: string;
  partner: { id: string; name: string; logoUrl: string | null };
  title: string;
  discountPercent: string;
  conditions: string | null;
  audience: BenefitAudience;
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
