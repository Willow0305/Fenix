import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Intermediário de PIX (DT-071). O sistema nunca confia só no aviso: ao receber um, busca a
 * situação da cobrança no próprio intermediário antes de baixar qualquer coisa.
 */
export type ProviderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface CreateChargeInput {
  readonly amount: string;
  readonly description: string;
  /** Referência nossa (id da cobrança), repetida pelo intermediário. */
  readonly externalReference: string;
  readonly expiresAt: Date;
  readonly payerEmail: string | null;
  readonly idempotencyKey: string;
}

export interface CreatedCharge {
  readonly providerChargeId: string;
  /** PIX "copia e cola" (BR Code). */
  readonly qrCode: string;
  readonly expiresAt: Date;
}

export interface ChargeStatus {
  readonly status: ProviderStatus;
  readonly paidAmount: string | null;
  readonly paidAt: Date | null;
}

export interface PixProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreatedCharge>;
  fetchStatus(providerChargeId: string): Promise<ChargeStatus>;
}

/**
 * Assinatura do aviso do Mercado Pago: HMAC-SHA256 em hexadecimal, com o segredo do
 * webhook, sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (documentação oficial).
 */
export function mercadoPagoSignatureValid(input: {
  readonly signatureHeader: string | undefined;
  readonly requestId: string | undefined;
  readonly dataId: string | undefined;
  readonly secret: string;
}): boolean {
  if (!input.signatureHeader || !input.requestId || !input.dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    input.signatureHeader.split(',').map((part) => {
      const [key = '', ...rest] = part.trim().split('=');

      return [key, rest.join('=')];
    })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) {
    return false;
  }

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest();
  const given = Buffer.from(v1, 'hex');

  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Campo do BR Code (EMV): id de 2 dígitos, tamanho de 2 dígitos e valor. */
function emv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16-CCITT (0x1021, inicial 0xFFFF), exigido no fim do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;

  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * BR Code de teste (modo simulado): formato válido, mas com chave fictícia — nenhum banco
 * consegue pagar. Serve para ver o QR e o "copia e cola" na tela.
 */
export function sandboxBrCode(amount: string, reference: string): string {
  const account = emv('00', 'br.gov.bcb.pix') + emv('01', 'teste@fenix.example');
  const body =
    emv('00', '01') +
    emv('26', account) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', amount) +
    emv('58', 'BR') +
    emv('59', 'FENIX VOLEI TESTE') +
    emv('60', 'RIO BRANCO') +
    emv('62', emv('05', reference.replace(/[^A-Za-z0-9]/g, '').slice(0, 25)));
  const withCrc = `${body}6304`;

  return withCrc + crc16(withCrc);
}
