import type { MiddlewareConsumer } from '@nestjs/common';
import { Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessControlModule } from './access-control/access-control.module';
import { PermissionsGuard } from './access-control/permissions.guard';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/csrf.guard';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { PrivacyModule } from './privacy/privacy.module';
import { SportsModule } from './sports/sports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    RateLimitModule,
    EmailModule,
    PrivacyModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    AccessControlModule,
    UsersModule,
    SportsModule,
    FinanceModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    }
  ]
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
