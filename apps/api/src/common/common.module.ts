import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit/audit.service';
import { AppConfig } from './config/app-config';
import { MailSender, OutboxMailSender } from './mail/mail.service';
import { PrismaService } from './prisma/prisma.service';
import { LocalObjectStorage, ObjectStorage } from './storage/object-storage';

/** Infraestrutura compartilhada por todos os módulos. */
@Global()
@Module({
  providers: [
    AppConfig,
    PrismaService,
    AuditService,
    { provide: MailSender, useClass: OutboxMailSender },
    { provide: ObjectStorage, useClass: LocalObjectStorage }
  ],
  exports: [AppConfig, PrismaService, AuditService, MailSender, ObjectStorage]
})
export class CommonModule {}
