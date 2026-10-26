import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditService } from './audit/audit.service';
import { AppConfig } from './config/app-config';
import { PostgresThrottlerStorage } from './http/postgres-throttler-storage';
import {
  SiteRevalidateInterceptor,
  SiteRevalidateService
} from './http/site-revalidate.interceptor';
import { JobScheduler } from './jobs/job-scheduler';
import { MailSender, mailSenderFor } from './mail/mail.service';
import { PrismaService } from './prisma/prisma.service';
import { RealtimeService } from './realtime/realtime.service';
import { LocalObjectStorage, ObjectStorage } from './storage/object-storage';
import { S3ObjectStorage } from './storage/s3-object-storage';
import { WhatsAppSender, whatsappSenderFor } from './whatsapp/whatsapp.service';

/** Infraestrutura compartilhada por todos os módulos. */
@Global()
@Module({
  providers: [
    AppConfig,
    PrismaService,
    AuditService,
    JobScheduler,
    PostgresThrottlerStorage,
    RealtimeService,
    SiteRevalidateService,
    { provide: MailSender, useFactory: mailSenderFor, inject: [AppConfig] },
    { provide: WhatsAppSender, useFactory: whatsappSenderFor, inject: [AppConfig] },
    {
      provide: ObjectStorage,
      useFactory: (config: AppConfig) =>
        config.values.s3 ? new S3ObjectStorage(config.values.s3) : new LocalObjectStorage(config),
      inject: [AppConfig]
    },
    { provide: APP_INTERCEPTOR, useClass: SiteRevalidateInterceptor }
  ],
  exports: [
    AppConfig,
    PrismaService,
    AuditService,
    JobScheduler,
    PostgresThrottlerStorage,
    RealtimeService,
    SiteRevalidateService,
    MailSender,
    WhatsAppSender,
    ObjectStorage
  ]
})
export class CommonModule {}
