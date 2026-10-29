/**
 * Cartão pelo site (DT-079): regras de parcelamento e o contrato com o intermediário. O
 * formulário do cartão é do próprio intermediário; aqui só chega o token do cartão.
 */
export const MAX_INSTALLMENTS = 12;

export type CardPaymentType = 'credit_card' | 'debit_card';
export type CardProviderStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED';

export interface CardPaymentInput {
  readonly amount: string;
  readonly token: string;
  readonly paymentMethodId: string;
  readonly issuerId: string | null;
  readonly installments: number;
  readonly paymentType: CardPaymentType;
  readonly payerEmail: string;
  readonly identification: { readonly type: string; readonly number: string } | null;
  readonly description: string;
  readonly externalReference: string;
  readonly idempotencyKey: string;
  /** Código de "preço diferenciado" do intermediário para o sem juros (PEN-067). */
  readonly differentialPricingId: string | null;
}

export interface CardPaymentResult {
  readonly providerPaymentId: string;
  readonly status: CardProviderStatus;
  readonly statusDetail: string | null;
  readonly paymentType: CardPaymentType;
  readonly brand: string | null;
  readonly lastFour: string | null;
  readonly paidAmount: string | null;
  readonly paidAt: Date | null;
}

export interface CardProvider {
  readonly name: string;
  pay(input: CardPaymentInput): Promise<CardPaymentResult>;
  fetch(providerPaymentId: string): Promise<CardPaymentResult>;
  refund(providerPaymentId: string, amount: string, idempotencyKey: string): Promise<string>;
}

/**
 * Parcelas sem juros do pedido: a menor regra entre os itens (o clube nunca paga juros que
 * não ofereceu); produto sem regra deixa o pedido só com juros (PEN-067, recomendação).
 */
export function interestFreeLimit(rules: readonly (number | null)[]): number {
  if (rules.length === 0 || rules.some((rule) => rule === null)) {
    return 0;
  }

  return Math.min(...(rules as number[]));
}

/** Códigos de preço diferenciado gravados nas configurações: { "3": "id", "6": "id" }. */
export function parseDifferentialPricing(value: unknown): Map<number, string> {
  const map = new Map<number, string>();

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, id] of Object.entries(value as Record<string, unknown>)) {
      const installments = Number(key);

      if (
        Number.isInteger(installments) &&
        installments >= 2 &&
        installments <= MAX_INSTALLMENTS &&
        typeof id === 'string' &&
        id.trim()
      ) {
        map.set(installments, id.trim());
      }
    }
  }

  return map;
}

/**
 * Sem juros que dá para oferecer de fato: até o limite do pedido, usando o maior código do
 * intermediário que não passa dele. No modo de teste não há código: vale o limite.
 */
export function effectiveInterestFree(
  limit: number,
  codes: ReadonlyMap<number, string>,
  simulated: boolean
): { upTo: number; differentialPricingId: string | null } {
  if (limit < 2) {
    return { upTo: 0, differentialPricingId: null };
  }

  if (simulated) {
    return { upTo: limit, differentialPricingId: null };
  }

  const best = [...codes.keys()].filter((n) => n <= limit).sort((a, b) => b - a)[0];

  return best === undefined
    ? { upTo: 0, differentialPricingId: null }
    : { upTo: best, differentialPricingId: codes.get(best) ?? null };
}

/** Método de pagamento do Caixa para o tipo do cartão. */
export function cardMethodCode(type: CardPaymentType): 'cartao-credito' | 'cartao-debito' {
  return type === 'debit_card' ? 'cartao-debito' : 'cartao-credito';
}

const REJECTIONS: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Limite insuficiente no cartão.',
  cc_rejected_bad_filled_security_code: 'Código de segurança inválido.',
  cc_rejected_bad_filled_date: 'Validade do cartão inválida.',
  cc_rejected_bad_filled_card_number: 'Número do cartão inválido.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
  cc_rejected_call_for_authorize:
    'O banco pediu autorização: libere a compra no app do banco e tente de novo.',
  cc_rejected_card_disabled: 'Cartão desativado. Fale com o banco ou use outro cartão.',
  cc_rejected_duplicated_payment: 'Pagamento repetido: confira se o primeiro já foi aprovado.',
  cc_rejected_high_risk: 'Recusado pela análise de segurança. Use outro cartão ou o PIX.',
  cc_rejected_max_attempts: 'Muitas tentativas. Use outro cartão ou o PIX.',
  cc_rejected_blacklist: 'Cartão não aceito. Use outro cartão ou o PIX.'
};

/** Motivo da recusa em português, sem detalhes técnicos. */
export function rejectionMessage(statusDetail: string | null): string {
  return (
    (statusDetail ? REJECTIONS[statusDetail] : undefined) ??
    'Cartão recusado. Tente outro cartão ou pague com PIX.'
  );
}
