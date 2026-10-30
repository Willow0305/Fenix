import { isBrazilState } from '@fenix/validation';

/**
 * Eventos externos e dados de agenda (D3, DT-081): organizador e link oficial, cidade livre
 * com UF quando no Brasil, entrada gratuita ou com preço e o jogo entre dois times de fora.
 */
export interface EventDetails {
  readonly isExternal: boolean;
  readonly organizerName: string | null;
  readonly officialUrl: string | null;
  readonly state: string | null;
  readonly isFree: boolean;
  readonly ticketPrice: string | null;
  readonly hasTeamMatch: boolean;
  readonly hasExternalMatch: boolean;
}

/** Texto opcional: espaços nas pontas saem e vazio vira "sem valor". */
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';

  return trimmed === '' ? null : trimmed;
}

export function normalizeState(value: string | null | undefined): string | null {
  return blankToNull(value)?.toUpperCase() ?? null;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function eventDetailsProblems(details: EventDetails): string[] {
  const problems: string[] = [];

  if (details.isExternal && details.organizerName === null) {
    problems.push('Informe quem organiza o evento externo.');
  }

  if (details.officialUrl !== null && !isHttpsUrl(details.officialUrl)) {
    problems.push('O link oficial precisa ser um endereço completo começando com https://.');
  }

  if (details.state !== null && !isBrazilState(details.state)) {
    problems.push('Escolha a UF da lista ou deixe em branco para fora do Brasil.');
  }

  if (details.isFree && details.ticketPrice !== null) {
    problems.push('Entrada gratuita não tem preço: desmarque uma das opções.');
  }

  if (details.isExternal && details.hasTeamMatch) {
    problems.push('Jogo do Fênix não é evento externo: use os dados da partida do Fênix.');
  }

  if (!details.isExternal && details.hasExternalMatch) {
    problems.push('Os times de fora só valem para evento externo.');
  }

  return problems;
}
