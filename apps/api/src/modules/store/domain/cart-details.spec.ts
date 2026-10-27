import {
  beneficiariesOf,
  beneficiaryProblems,
  cleanBeneficiary,
  resizeBeneficiaries
} from './cart-details';

const buyer = { name: 'Ana Compradora', email: 'ana@exemplo.test', cardId: null };

describe('beneficiários da afiliação (DT-068)', () => {
  it('linha nova começa com quem compra e completa até a quantidade', () => {
    const list = resizeBeneficiaries([], 3, buyer);

    expect(list).toHaveLength(3);
    expect(list[0]).toEqual(buyer);
    expect(list[2]).toEqual({ name: '', email: null, cardId: null });
  });

  it('diminuir a quantidade corta do fim; aumentar mantém os já informados', () => {
    const three = resizeBeneficiaries([buyer, { ...buyer, name: 'Rui Silva' }], 3, buyer);

    expect(resizeBeneficiaries(three, 1, buyer)).toEqual([buyer]);
    expect(resizeBeneficiaries(three, 4, buyer)[1]?.name).toBe('Rui Silva');
  });

  it('exige nome completo, e-mail válido e não repete renovação', () => {
    const problems = beneficiaryProblems([
      { name: 'Ana', email: null, cardId: null },
      { name: 'Bia Souza', email: 'bia@', cardId: null },
      { name: 'Caio Lima', email: null, cardId: 'x' },
      { name: 'Davi Reis', email: null, cardId: 'x' }
    ]);

    expect(problems.map((p) => p.index)).toEqual([0, 1, 3]);
    expect(beneficiaryProblems([buyer])).toEqual([]);
  });

  it('limpa o que vem do cliente e lê o salvo com segurança', () => {
    expect(cleanBeneficiary({ name: '  Ana   Maria ', email: ' ANA@X.COM ' })).toEqual({
      name: 'Ana Maria',
      email: 'ana@x.com',
      cardId: null
    });
    expect(beneficiariesOf(null)).toEqual([]);
    expect(beneficiariesOf({ beneficiaries: [buyer] })).toEqual([buyer]);
  });
});
