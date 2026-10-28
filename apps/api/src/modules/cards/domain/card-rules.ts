import { randomInt } from 'node:crypto';

/**
 * Regras da carteirinha (DT-068): quando ela vale, o que quem confere vê e o número
 * impresso. Funções puras, sem banco.
 */
/** Atleta e diretoria são gratuitas e automáticas; afiliado é comprado (DT-068, DT-077). */
export type CardKind = 'ATHLETE' | 'AFFILIATE' | 'BOARD';

export type CardState =
  | 'VALID'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'ATHLETE_INACTIVE'
  | 'BOARD_INACTIVE'
  | 'REPLACED';

export const CARD_STATE_LABELS: Record<CardState, string> = {
  VALID: 'Válida',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
  NOT_STARTED: 'Ainda não começou',
  ATHLETE_INACTIVE: 'Atleta não está ativo',
  BOARD_INACTIVE: 'Não faz mais parte da diretoria',
  REPLACED: 'Substituída por uma reemissão'
};

export interface CardFacts {
  readonly type: CardKind;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  readonly deleted: boolean;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly athleteStatus: string | null;
  /** Diretoria: a pessoa ainda tem o papel Diretoria (conta ativa). */
  readonly boardActive?: boolean;
}

/** Situação da carteirinha numa data civil (fuso do time). */
export function cardState(card: CardFacts, today: string): CardState {
  if (card.deleted || card.status === 'CANCELLED') {
    return 'CANCELLED';
  }

  if (card.status === 'SUSPENDED') {
    return 'SUSPENDED';
  }

  if (card.type === 'ATHLETE') {
    return card.athleteStatus === 'ACTIVE' ? 'VALID' : 'ATHLETE_INACTIVE';
  }

  // Diretoria: vale enquanto a pessoa tiver o papel (DT-077).
  if (card.type === 'BOARD') {
    return card.boardActive ? 'VALID' : 'BOARD_INACTIVE';
  }

  if (card.startsOn !== null && card.startsOn > today) {
    return 'NOT_STARTED';
  }

  if (card.endsOn !== null && card.endsOn < today) {
    return 'EXPIRED';
  }

  return 'VALID';
}

/**
 * O que quem confere sem login vê (DT-068 C). Suspensa, cancelada ou substituída aparece
 * só como "inválida", sem o motivo; vencida aparece como vencida.
 */
export function publicStateLabel(state: CardState): string {
  if (state === 'VALID') {
    return 'Válida';
  }

  return state === 'EXPIRED' ? 'Vencida' : 'Inválida';
}

/** "Ana Silva Souza" → "Ana S."; menor sem autorização → só "Ana". */
export function shortName(fullName: string, firstNameOnly = false): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';

  return firstNameOnly || !last ? first : `${first} ${last.charAt(0).toUpperCase()}.`;
}

/** Letras e dígitos sem os que se confundem (0/O, 1/I/L). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newCardCode(): string {
  let code = '';

  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return `FNX-${code}`;
}

export interface BenefitAudiences {
  readonly forBoard: boolean;
  readonly forAthletes: boolean;
  readonly forAffiliates: boolean;
}

/** Benefício vale para este tipo de carteirinha? (públicos marcados, DT-077) */
export function benefitApplies(audiences: BenefitAudiences, type: CardKind): boolean {
  return type === 'BOARD'
    ? audiences.forBoard
    : type === 'ATHLETE'
      ? audiences.forAthletes
      : audiences.forAffiliates;
}

/** Filtro do banco para os benefícios de um tipo de carteirinha. */
export function audienceField(type: CardKind): keyof BenefitAudiences {
  return type === 'BOARD' ? 'forBoard' : type === 'ATHLETE' ? 'forAthletes' : 'forAffiliates';
}

/** Renovação soma ao período: começa no fim atual (se ainda vale) ou hoje. */
export function renewedPeriod(
  currentEndsOn: string | null,
  today: string,
  months: number
): { startsOn: string; endsOn: string } {
  const base = currentEndsOn !== null && currentEndsOn >= today ? currentEndsOn : today;

  return { startsOn: today, endsOn: addMonths(base, months) };
}

export function addMonths(civil: string, months: number): string {
  const [y, m, d] = civil.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
