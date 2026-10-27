import { randomUUID } from 'node:crypto';

import { AppError } from '../../../common/errors/app-error';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import {
  type ChargeStatus,
  type CreateChargeInput,
  type CreatedCharge,
  type PixProvider,
  sandboxBrCode
} from '../domain/pix-provider';

const UNAVAILABLE = 'PIX automático indisponível agora. Use o PIX com comprovante.';

/**
 * Modo de teste (DT-071): cria cobranças fictícias e só as considera pagas quando alguém
 * aciona "Simular pagamento" (marca `simulatedPaidAt`). Proibido em produção pela config.
 */
export class SandboxPixProvider implements PixProvider {
  readonly name = 'sandbox';

  constructor(private readonly prisma: PrismaService) {}

  createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
    return Promise.resolve({
      providerChargeId: `sbx_${randomUUID()}`,
      qrCode: sandboxBrCode(input.amount, input.externalReference),
      expiresAt: input.expiresAt
    });
  }

  async fetchStatus(providerChargeId: string): Promise<ChargeStatus> {
    const charge = await this.prisma.pixCharge.findUnique({
      where: { provider_providerChargeId: { provider: this.name, providerChargeId } },
      select: { simulatedPaidAt: true, amount: true, expiresAt: true }
    });

    if (charge?.simulatedPaidAt) {
      return {
        status: 'PAID',
        paidAmount: charge.amount.toFixed(2),
        paidAt: charge.simulatedPaidAt
      };
    }

    return {
      status: charge && charge.expiresAt < new Date() ? 'EXPIRED' : 'PENDING',
      paidAmount: null,
      paidAt: null
    };
  }
}

interface MercadoPagoPayment {
  readonly id: number | string;
  readonly status: string;
  readonly status_detail?: string;
  readonly transaction_amount?: number;
  readonly date_approved?: string | null;
  readonly date_of_expiration?: string | null;
  readonly point_of_interaction?: { readonly transaction_data?: { readonly qr_code?: string } };
}

/**
 * Mercado Pago (`/v1/payments`, `payment_method_id: pix`). O token nunca vai para log ou
 * mensagem de erro; falha de rede vira "indisponível" e o PIX com comprovante continua.
 */
export class MercadoPagoPixProvider implements PixProvider {
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
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw AppError.conflict('PIX_UNAVAILABLE', UNAVAILABLE);
    }

    if (!response.ok) {
      throw AppError.conflict('PIX_UNAVAILABLE', UNAVAILABLE);
    }

    return (await response.json()) as T;
  }

  async createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
    const payment = await this.request<MercadoPagoPayment>('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        transaction_amount: Number(input.amount),
        description: input.description,
        payment_method_id: 'pix',
        external_reference: input.externalReference,
        date_of_expiration: input.expiresAt.toISOString(),
        payer: { email: input.payerEmail ?? 'pagador@fenix.example' },
        ...(this.notificationUrl ? { notification_url: this.notificationUrl } : {})
      })
    });
    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code;

    if (!qrCode) {
      throw AppError.conflict('PIX_UNAVAILABLE', UNAVAILABLE);
    }

    return {
      providerChargeId: String(payment.id),
      qrCode,
      expiresAt: payment.date_of_expiration ? new Date(payment.date_of_expiration) : input.expiresAt
    };
  }

  async fetchStatus(providerChargeId: string): Promise<ChargeStatus> {
    const payment = await this.request<MercadoPagoPayment>(
      `/v1/payments/${encodeURIComponent(providerChargeId)}`,
      { method: 'GET' }
    );

    if (payment.status === 'approved') {
      return {
        status: 'PAID',
        paidAmount: payment.transaction_amount?.toFixed(2) ?? null,
        paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date()
      };
    }

    if (payment.status === 'cancelled' || payment.status === 'rejected') {
      return {
        status: payment.status_detail === 'expired' ? 'EXPIRED' : 'CANCELLED',
        paidAmount: null,
        paidAt: null
      };
    }

    return { status: 'PENDING', paidAmount: null, paidAt: null };
  }
}
