import { randomUUID } from 'node:crypto';

import { AppError } from '../../../common/errors/app-error';
import type {
  CardPaymentInput,
  CardPaymentResult,
  CardPaymentType,
  CardProvider,
  CardProviderStatus
} from '../domain/card-payment';

const UNAVAILABLE = 'Pagamento com cartão indisponível agora. Tente de novo ou pague com PIX.';

/**
 * Modo de teste (DT-079): o "token" diz o resultado (`sandbox-approved`, `sandbox-rejected`
 * ou `sandbox-pending`). Proibido em produção pela configuração.
 */
export class SandboxCardProvider implements CardProvider {
  readonly name = 'sandbox';

  pay(input: CardPaymentInput): Promise<CardPaymentResult> {
    const status: CardProviderStatus =
      input.token === 'sandbox-rejected'
        ? 'REJECTED'
        : input.token === 'sandbox-pending'
          ? 'PENDING'
          : 'APPROVED';

    return Promise.resolve({
      providerPaymentId: `sbx_${randomUUID()}`,
      status,
      statusDetail: status === 'REJECTED' ? 'cc_rejected_insufficient_amount' : null,
      paymentType: input.paymentType,
      brand: input.paymentMethodId,
      lastFour: '4242',
      paidAmount: status === 'APPROVED' ? input.amount : null,
      paidAt: status === 'APPROVED' ? new Date() : null
    });
  }

  /** No modo de teste o pendente continua pendente (não há banco do outro lado). */
  fetch(providerPaymentId: string): Promise<CardPaymentResult> {
    return Promise.resolve({
      providerPaymentId,
      status: 'PENDING',
      statusDetail: null,
      paymentType: 'credit_card',
      brand: null,
      lastFour: null,
      paidAmount: null,
      paidAt: null
    });
  }

  refund(): Promise<string> {
    return Promise.resolve(`sbx_refund_${randomUUID()}`);
  }
}

interface MercadoPagoCardPayment {
  readonly id: number | string;
  readonly status: string;
  readonly status_detail?: string;
  readonly payment_type_id?: string;
  readonly payment_method_id?: string;
  readonly transaction_amount?: number;
  readonly date_approved?: string | null;
  readonly card?: { readonly last_four_digits?: string | null };
}

function toResult(payment: MercadoPagoCardPayment): CardPaymentResult {
  const status: CardProviderStatus =
    payment.status === 'approved'
      ? 'APPROVED'
      : payment.status === 'rejected'
        ? 'REJECTED'
        : payment.status === 'cancelled' || payment.status === 'refunded'
          ? 'CANCELLED'
          : 'PENDING';

  return {
    providerPaymentId: String(payment.id),
    status,
    statusDetail: payment.status_detail ?? null,
    paymentType: (payment.payment_type_id === 'debit_card'
      ? 'debit_card'
      : 'credit_card') satisfies CardPaymentType,
    brand: payment.payment_method_id ?? null,
    lastFour: payment.card?.last_four_digits ?? null,
    paidAmount: status === 'APPROVED' ? (payment.transaction_amount?.toFixed(2) ?? null) : null,
    paidAt:
      status === 'APPROVED'
        ? payment.date_approved
          ? new Date(payment.date_approved)
          : new Date()
        : null
  };
}

/**
 * Mercado Pago (`/v1/payments` com o token do formulário do próprio Mercado Pago). O token
 * de acesso nunca vai para log ou mensagem de erro; os juros do parcelado são do comprador.
 */
export class MercadoPagoCardProvider implements CardProvider {
  readonly name = 'mercadopago';
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(
    private readonly accessToken: string,
    private readonly notificationUrl: string | null
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> | undefined)
        },
        signal: AbortSignal.timeout(20_000)
      });
    } catch {
      throw AppError.conflict('CARD_UNAVAILABLE', UNAVAILABLE);
    }

    if (response.status === 400) {
      throw AppError.validation('CARD_INVALID', 'Confira os dados do cartão e tente de novo.');
    }

    if (!response.ok) {
      throw AppError.conflict('CARD_UNAVAILABLE', UNAVAILABLE);
    }

    return (await response.json()) as T;
  }

  async pay(input: CardPaymentInput): Promise<CardPaymentResult> {
    const payment = await this.request<MercadoPagoCardPayment>('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        transaction_amount: Number(input.amount),
        token: input.token,
        description: input.description,
        installments: input.installments,
        payment_method_id: input.paymentMethodId,
        ...(input.issuerId ? { issuer_id: input.issuerId } : {}),
        payer: {
          email: input.payerEmail,
          ...(input.identification ? { identification: input.identification } : {})
        },
        external_reference: input.externalReference,
        statement_descriptor: 'FENIX VOLEI',
        ...(input.differentialPricingId
          ? {
              differential_pricing_id:
                Number(input.differentialPricingId) || input.differentialPricingId
            }
          : {}),
        ...(this.notificationUrl ? { notification_url: this.notificationUrl } : {})
      })
    });

    return toResult(payment);
  }

  async fetch(providerPaymentId: string): Promise<CardPaymentResult> {
    return toResult(
      await this.request<MercadoPagoCardPayment>(
        `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
        { method: 'GET' }
      )
    );
  }

  async refund(providerPaymentId: string, amount: string, idempotencyKey: string): Promise<string> {
    const refund = await this.request<{ id: number | string }>(
      `/v1/payments/${encodeURIComponent(providerPaymentId)}/refunds`,
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ amount: Number(amount) })
      }
    );

    return String(refund.id);
  }
}
