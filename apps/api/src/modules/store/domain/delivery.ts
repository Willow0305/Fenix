import { type Money, money } from '../../../common/domain/money';

/** Endereço de entrega guardado no pedido (cópia da compra, DT-075). */
export interface DeliveryAddress {
  readonly postalCode: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string | null;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly reference: string | null;
  readonly phone: string | null;
  /** Região e prazo vigentes na compra. */
  readonly zoneName: string;
  readonly leadDays: number;
}

export interface AddressInput {
  readonly postalCode: string;
  readonly street: string;
  readonly number: string;
  readonly complement?: string | null | undefined;
  readonly reference?: string | null | undefined;
  readonly phone?: string | null | undefined;
}

/** "  Jardim  Europa " → "jardim europa": compara bairro sem acento, caixa ou espaço extra. */
export function normalizeNeighborhood(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** CEP só com dígitos; nulo se não tiver 8. */
export function cleanPostalCode(value: string): string | null {
  const digits = value.replace(/\D/g, '');

  return digits.length === 8 ? digits : null;
}

/** Lista de bairros digitada (um por linha ou separados por vírgula), sem repetidos. */
export function parseNeighborhoods(text: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of text.flatMap((entry) => entry.split(/[\n,;]/))) {
    const name = raw.replace(/\s+/g, ' ').trim();
    const key = normalizeNeighborhood(name);

    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }

  return result;
}

/**
 * Taxa da entrega (RN-ENT-002/003): a da região, ou zero quando os produtos (já com
 * desconto) chegam ao mínimo do frete grátis configurado.
 */
export function deliveryFee(input: {
  readonly zoneFee: Money;
  readonly productsTotal: Money;
  readonly freeMinimum: Money | null;
}): Money {
  if (input.freeMinimum !== null && input.productsTotal.gte(input.freeMinimum)) {
    return money(0);
  }

  return input.zoneFee;
}

/** Problemas do endereço digitado, campo a campo (mensagens para a tela). */
export function addressProblems(
  input: AddressInput
): { field: string; code: string; message: string }[] {
  const problems: { field: string; code: string; message: string }[] = [];

  if (cleanPostalCode(input.postalCode) === null) {
    problems.push({ field: 'postalCode', code: 'INVALID', message: 'CEP deve ter 8 números.' });
  }

  if (input.street.trim().length < 3) {
    problems.push({ field: 'street', code: 'REQUIRED', message: 'Informe a rua.' });
  }

  if (!input.number.trim()) {
    problems.push({ field: 'number', code: 'REQUIRED', message: 'Informe o número (ou "s/n").' });
  }

  return problems;
}

/** Texto de uma linha para telas e avisos: "Rua X, 10, ap 2 — Centro, Rio Branco/AC". */
export function addressLine(address: DeliveryAddress): string {
  const street = [address.street, address.number, address.complement].filter(Boolean).join(', ');

  return `${street} — ${address.neighborhood}, ${address.city}/${address.state}`;
}
