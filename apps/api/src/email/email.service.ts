import { Injectable } from '@nestjs/common';

import {
  emailVerificationTemplate,
  passwordRecoveryTemplate,
  securityAlertTemplate
} from './email-templates';
import { TransactionalEmailSender } from './transactional-email.sender';

@Injectable()
export class EmailService {
  public constructor(private readonly sender: TransactionalEmailSender) {}

  public async sendPasswordRecovery(
    recipient: string,
    code: string,
    expiresInMinutes: number
  ): Promise<void> {
    await this.sender.send({
      recipient,
      ...passwordRecoveryTemplate({
        code,
        expiresIn: `${expiresInMinutes} minutos`
      })
    });
  }

  public async sendEmailVerification(
    recipient: string,
    code: string,
    expiresInHours: number
  ): Promise<void> {
    await this.sender.send({
      recipient,
      ...emailVerificationTemplate({
        code,
        expiresIn: `${expiresInHours} horas`
      })
    });
  }

  public async sendSecurityAlert(recipient: string, eventDescription: string): Promise<void> {
    await this.sender.send({
      recipient,
      ...securityAlertTemplate(eventDescription)
    });
  }
}
