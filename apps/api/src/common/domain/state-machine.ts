import { AppError } from '../errors/app-error';

/** Tabela de transições permitidas. Estados ausentes da chave são terminais. */
export type TransitionTable<S extends string> = Partial<Record<S, readonly S[]>>;

export function canTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S
): boolean {
  return (table[from] ?? []).includes(to);
}

/** Lança 409 quando a transição não é permitida (nenhuma transição é presumida). */
export function assertTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
  labels: Partial<Record<S, string>> = {}
): void {
  if (!canTransition(table, from, to)) {
    throw AppError.conflict(
      'INVALID_TRANSITION',
      `Não é possível mudar de "${labels[from] ?? from}" para "${labels[to] ?? to}".`
    );
  }
}
