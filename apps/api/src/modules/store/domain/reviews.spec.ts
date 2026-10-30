import { normalizeComment, ratingSummary, reviewerName, reviewProblems } from './reviews';

describe('avaliações de produto', () => {
  it('aceita só nota inteira de 1 a 5', () => {
    expect(reviewProblems({ rating: 5 })).toEqual([]);
    expect(reviewProblems({ rating: 0 })).toHaveLength(1);
    expect(reviewProblems({ rating: 6 })).toHaveLength(1);
    expect(reviewProblems({ rating: 4.5 })).toHaveLength(1);
  });

  it('limita o comentário a 1000 caracteres', () => {
    expect(reviewProblems({ rating: 4, comment: 'a'.repeat(1000) })).toEqual([]);
    expect(reviewProblems({ rating: 4, comment: 'a'.repeat(1001) })).toHaveLength(1);
  });

  it('guarda o comentário limpo e trata vazio como nulo', () => {
    expect(normalizeComment('  Ótima camisa  ')).toBe('Ótima camisa');
    expect(normalizeComment('   ')).toBeNull();
    expect(normalizeComment('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('mostra só o primeiro nome', () => {
    expect(reviewerName('Ana Souza Lima')).toBe('Ana');
    expect(reviewerName('  ')).toBe('Cliente');
  });

  it('calcula a média com uma casa e o total', () => {
    expect(ratingSummary([])).toEqual({ average: null, count: 0 });
    expect(ratingSummary([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});
