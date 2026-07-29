import { Global, Module } from '@nestjs/common';

import { EmailService } from './email.service';
import { SmtpEmailSender } from './smtp-email.sender';
import { TransactionalEmailSender } from './transactional-email.sender';

@Global()
@Module({
  exports: [EmailService],
  providers: [
    EmailService,
    SmtpEmailSender,
    {
      provide: TransactionalEmailSender,
      useExisting: SmtpEmailSender
    }
  ]
})
export class EmailModule {}
