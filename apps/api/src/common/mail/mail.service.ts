import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { AppConfig } from '../config/app-config';
import { DeliveryError, type SendResult } from '../messaging/delivery-error';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Porta de envio de e-mail (DT-024, DT-048). */
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<SendResult>;
}

/**
 * Adaptador de desenvolvimento: grava cada mensagem como arquivo em `MAIL_OUTBOX_DIR`.
 * Conteúdo e destinatário nunca são escritos em log.
 */
@Injectable()
export class OutboxMailSender extends MailSender {
  private readonly logger = new Logger('Mail');

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: MailMessage): Promise<SendResult> {
    const dir = resolve(this.config.values.mailOutboxDir);
    const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;

    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, `${id}.eml.txt`),
      [
        `From: ${this.config.values.mailFrom}`,
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text
      ].join('\n'),
      'utf8'
    );
    this.logger.log(`Mensagem gravada na caixa de saída local (${id}).`);

    return { providerMessageId: id };
  }
}

interface SmtpFailure {
  readonly code?: unknown;
  readonly responseCode?: unknown;
}

/** Recusa definitiva (5xx no envelope) não é repetida; conexão e 4xx tentam de novo. */
export function smtpDeliveryError(error: unknown): DeliveryError {
  const { code, responseCode } = (error ?? {}) as SmtpFailure;
  const status = typeof responseCode === 'number' ? responseCode : null;

  if (code === 'EENVELOPE' || (status !== null && status >= 550 && status < 560)) {
    return new DeliveryError('SMTP_RECUSADO', true);
  }

  if (code === 'EAUTH') {
    return new DeliveryError('SMTP_AUTENTICACAO', false);
  }

  return new DeliveryError(status ? `SMTP_${status}` : 'SMTP_INDISPONIVEL', false);
}

/** Envio real por SMTP (qualquer provedor: Brevo, Amazon SES, Gmail Workspace, etc.). */
@Injectable()
export class SmtpMailSender extends MailSender {
  private readonly transport: Transporter;

  constructor(private readonly config: AppConfig) {
    super();

    const smtp = config.values.smtp;

    if (!smtp) {
      throw new Error('SMTP não configurado.');
    }

    this.transport = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      // Sem TLS desde a conexão, exige STARTTLS: credencial nunca trafega em claro.
      requireTLS: !smtp.secure,
      ...(smtp.user && smtp.password ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000
    });
  }

  async send(message: MailMessage): Promise<SendResult> {
    try {
      const info = await this.transport.sendMail({
        from: this.config.values.mailFrom,
        to: message.to,
        subject: message.subject,
        text: message.text
      });

      return { providerMessageId: info.messageId.slice(0, 160) || null };
    } catch (error) {
      throw smtpDeliveryError(error);
    }
  }
}

export function mailSenderFor(config: AppConfig): MailSender {
  return config.values.mailDriver === 'smtp'
    ? new SmtpMailSender(config)
    : new OutboxMailSender(config);
}
