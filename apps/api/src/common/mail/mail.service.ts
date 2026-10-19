import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfig } from '../config/app-config';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** Porta de envio de e-mail (DT-024). */
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>;
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

  async send(message: MailMessage): Promise<void> {
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
  }
}
