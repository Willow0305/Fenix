/** Avaliações de produto (DT-081): regras puras, sem banco. */

export const REVIEW_COMMENT_MAX = 1000;

export interface ReviewInput {
  readonly rating: number;
  readonly comment?: string | null | undefined;
}

/** Nota inteira de 1 a 5; comentário opcional, sem só espaços, até 1000 caracteres. */
export function reviewProblems(input: ReviewInput): string[] {
  const problems: string[] = [];

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    problems.push('Escolha de 1 a 5 estrelas.');
  }

  if ((input.comment ?? '').trim().length > REVIEW_COMMENT_MAX) {
    problems.push(`Escreva o comentário em até ${REVIEW_COMMENT_MAX} caracteres.`);
  }

  return problems;
}

/** Comentário guardado sem espaços sobrando; vazio vira nulo. */
export function normalizeComment(comment: string | null | undefined): string | null {
  const text = (comment ?? '').trim().replace(/\n{3,}/g, '\n\n');

  return text === '' ? null : text;
}

/** O site mostra só o primeiro nome de quem avaliou. */
export function reviewerName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Cliente';
}

/** Média com uma casa decimal (4,3) e total de avaliações aprovadas. */
export function ratingSummary(ratings: readonly number[]): {
  average: number | null;
  count: number;
} {
  if (ratings.length === 0) {
    return { average: null, count: 0 };
  }

  const sum = ratings.reduce((total, rating) => total + rating, 0);

  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}
