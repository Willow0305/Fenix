import { Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { TransactionalEmailSender, type TransactionalEmail } from './transactional-email.sender';

function readPort(): number {
  const port = Number(process.env['SMTP_PORT'] ?? 1025);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SMTP_PORT deve ser uma porta válida.');
  }

  return port;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  if (!['true', 'false'].includes(value)) {
    throw new Error(`${name} deve ser true ou false.`);
  }

  return value === 'true';
}

@Injectable()
export class SmtpEmailSender extends TransactionalEmailSender {
  private readonly transporter: Transporter;
  private readonly sender: string;

  public constructor() {
    super();
    this.sender = process.env['SMTP_FROM'] ?? 'no-reply@fenix.local';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(this.sender)) {
      throw new Error('SMTP_FROM deve ser um endereço de e-mail simples e válido.');
    }

    this.transporter = nodemailer.createTransport({
      disableFileAccess: true,
      disableUrlAccess: true,
      host: process.env['SMTP_HOST'] ?? '127.0.0.1',
      name: process.env['SMTP_CLIENT_NAME'] ?? 'fenix.local',
      port: readPort(),
      secure: readBoolean('SMTP_SECURE', false),
      ...(process.env['SMTP_USER'] && process.env['SMTP_PASSWORD']
        ? {
            auth: {
              user: process.env['SMTP_USER'],
              pass: process.env['SMTP_PASSWORD']
            }
          }
        : {}),
      tls: {
        rejectUnauthorized: readBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', true)
      }
    });
  }

  public async send(message: TransactionalEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.sender,
      to: message.recipient,
      subject: message.subject,
      text: message.text
    });
  }
}
