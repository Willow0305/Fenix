import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditService } from './audit/audit.service';
import { AppConfig } from './config/app-config';
import { PostgresThrottlerStorage } from './http/postgres-throttler-storage';
import { SiteRevalidateInterceptor } from './http/site-revalidate.interceptor';
import { JobScheduler } from './jobs/job-scheduler';
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
    JobScheduler,
    PostgresThrottlerStorage,
    { provide: MailSender, useClass: OutboxMailSender },
    { provide: ObjectStorage, useClass: LocalObjectStorage },
    { provide: APP_INTERCEPTOR, useClass: SiteRevalidateInterceptor }
  ],
  exports: [
    AppConfig,
    PrismaService,
    AuditService,
    JobScheduler,
    PostgresThrottlerStorage,
    MailSender,
    ObjectStorage
  ]
})
export class CommonModule {}
