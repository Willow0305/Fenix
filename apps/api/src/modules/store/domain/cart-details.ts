/**
 * Detalhes por linha do carrinho e do pedido (DT-068, DT-069): beneficiários de afiliação
 * e, na personalização, os valores escolhidos. Funções puras.
 */
export interface Beneficiary {
  readonly name: string;
  readonly email: string | null;
  /** Carteirinha de afiliado que será renovada (soma ao período). */
  readonly cardId: string | null;
}

export interface CartItemDetails {
  readonly beneficiaries?: readonly Beneficiary[];
}

export interface BeneficiaryProblem {
  readonly index: number;
  readonly message: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyBeneficiary(): Beneficiary {
  return { name: '', email: null, cardId: null };
}

/** Limpa o que veio do cliente: nome sem espaços extras, e-mail minúsculo ou nulo. */
export function cleanBeneficiary(input: {
  name?: string | null;
  email?: string | null;
  cardId?: string | null;
}): Beneficiary {
  const email = input.email?.trim().toLowerCase() || null;

  return {
    name: (input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 160),
    email,
    cardId: input.cardId || null
  };
}

/**
 * Ajusta a lista à quantidade: corta o excesso e completa com vazios. Linha nova começa
 * com quem compra como beneficiário 1 (DT-068).
 */
export function resizeBeneficiaries(
  current: readonly Beneficiary[],
  quantity: number,
  buyer: Beneficiary | null
): Beneficiary[] {
  const list = current.slice(0, quantity);

  if (list.length === 0 && buyer && quantity > 0) {
    list.push(buyer);
  }

  while (list.length < quantity) {
    list.push(emptyBeneficiary());
  }

  return list;
}

/** Problemas que impedem fechar o pedido (nome, e-mail, renovação repetida). */
export function beneficiaryProblems(list: readonly Beneficiary[]): BeneficiaryProblem[] {
  const problems: BeneficiaryProblem[] = [];
  const renewals = new Set<string>();

  list.forEach((b, index) => {
    if (b.name.length < 3 || !b.name.includes(' ')) {
      problems.push({ index, message: `Beneficiário ${index + 1}: informe o nome completo.` });
    }

    if (b.email !== null && !EMAIL.test(b.email)) {
      problems.push({ index, message: `Beneficiário ${index + 1}: e-mail inválido.` });
    }

    if (b.cardId !== null) {
      if (renewals.has(b.cardId)) {
        problems.push({
          index,
          message: `Beneficiário ${index + 1}: a mesma carteirinha está duas vezes.`
        });
      }

      renewals.add(b.cardId);
    }
  });

  return problems;
}

export function beneficiariesOf(details: unknown): Beneficiary[] {
  const list = (details as CartItemDetails | null)?.beneficiaries;

  return Array.isArray(list) ? list.map((b) => cleanBeneficiary(b)) : [];
}
