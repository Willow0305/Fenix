import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AccountService } from './application/account.service';
import { AuthService } from './application/auth.service';
import { MfaService } from './application/mfa.service';
import { PrincipalLoader } from './application/principal-loader.service';
import { SessionLifetimeService } from './application/session-lifetime.service';
import { AuthController } from './http/auth.controller';
import { AuthGuard } from './http/auth.guard';
import { MeController } from './http/me.controller';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccountService,
    PrincipalLoader,
    SessionLifetimeService,
    MfaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard }
  ],
  exports: [AuthService, MfaService]
})
export class AuthModule {}
