import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfig, type WhatsAppCloudConfig } from '../config/app-config';
import { DeliveryError, type SendResult } from '../messaging/delivery-error';

export interface WhatsAppMessage {
  /** Número internacional só com dígitos (ex.: 5568999990000). */
  readonly to: string;
  /** Variáveis do modelo aprovado: nome, título, texto e link. */
  readonly parameters: readonly string[];
}

/** Porta de envio por WhatsApp (DT-048). */
export abstract class WhatsAppSender {
  /** Falso quando o canal está desligado (`WHATSAPP_DRIVER=off`). */
  abstract readonly enabled: boolean;
  abstract send(message: WhatsAppMessage): Promise<SendResult>;
}

@Injectable()
export class DisabledWhatsAppSender extends WhatsAppSender {
  readonly enabled = false;

  send(): Promise<SendResult> {
    return Promise.reject(new DeliveryError('WHATSAPP_DESLIGADO', true));
  }
}

/** Modo de teste: grava a mensagem em `WHATSAPP_OUTBOX_DIR`, sem enviar. */
@Injectable()
export class OutboxWhatsAppSender extends WhatsAppSender {
  readonly enabled = true;
  private readonly logger = new Logger('WhatsApp');

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: WhatsAppMessage): Promise<SendResult> {
    const dir = resolve(this.config.values.whatsappOutboxDir);
    const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;

    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${id}.json`),
      JSON.stringify({ to: message.to, parameters: message.parameters }, null, 2),
      'utf8'
    );
    this.logger.log(`Mensagem gravada na caixa de saída local (${id}).`);

    return { providerMessageId: id };
  }
}

interface GraphError {
  readonly error?: { readonly code?: unknown; readonly error_subcode?: unknown };
}

/**
 * Códigos da Meta que não melhoram com nova tentativa: parâmetro inválido (100), número sem
 * WhatsApp ou fora da lista de teste (131026, 131030), modelo ausente ou recusado (132000 a
 * 132016), pagamento da conta (131042).
 */
const PERMANENT_CODES = new Set([100, 131008, 131009, 131026, 131030, 131042, 131051]);

export function whatsappDeliveryError(httpStatus: number, body: unknown): DeliveryError {
  const code = (body as GraphError | null)?.error?.code;

  if (typeof code === 'number') {
    const permanent = PERMANENT_CODES.has(code) || (code >= 132000 && code <= 132016);

    return new DeliveryError(`WHATSAPP_${code}`, permanent);
  }

  return new DeliveryError(`WHATSAPP_HTTP_${httpStatus}`, httpStatus >= 400 && httpStatus < 500);
}

/** Envio pela WhatsApp Cloud API da Meta, com modelo de mensagem aprovado. */
@Injectable()
export class CloudWhatsAppSender extends WhatsAppSender {
  readonly enabled = true;
  private readonly cloud: WhatsAppCloudConfig;

  constructor(config: AppConfig) {
    super();

    if (!config.values.whatsappCloud) {
      throw new Error('WhatsApp Cloud API não configurada.');
    }

    this.cloud = config.values.whatsappCloud;
  }

  async send(message: WhatsAppMessage): Promise<SendResult> {
    const url = `https://graph.facebook.com/${this.cloud.apiVersion}/${this.cloud.phoneNumberId}/messages`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cloud.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: message.to,
          type: 'template',
          template: {
            name: this.cloud.templateName,
            language: { code: this.cloud.templateLanguage },
            components: [
              {
                type: 'body',
                parameters: message.parameters.map((text) => ({ type: 'text', text }))
              }
            ]
          }
        }),
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      throw new DeliveryError('WHATSAPP_INDISPONIVEL', false);
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw whatsappDeliveryError(response.status, body);
    }

    const id = (body as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id;

    return { providerMessageId: typeof id === 'string' ? id.slice(0, 160) : null };
  }
}

export function whatsappSenderFor(config: AppConfig): WhatsAppSender {
  switch (config.values.whatsappDriver) {
    case 'cloud':
      return new CloudWhatsAppSender(config);
    case 'outbox':
      return new OutboxWhatsAppSender(config);
    default:
      return new DisabledWhatsAppSender();
  }
}
