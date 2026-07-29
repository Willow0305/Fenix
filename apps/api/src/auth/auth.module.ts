import { Module } from '@nestjs/common';

import { AccessTokenService } from './access-token.service';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { MfaService } from './mfa.service';
import { PasswordHasherService } from './password-hasher.service';
import { TotpService } from './totp.service';

@Module({
  controllers: [AuthController],
  exports: [AuthConfig, AuthService, EmailVerificationService, MfaService, PasswordHasherService],
  providers: [
    AuthConfig,
    AuthService,
    AccessTokenService,
    EmailVerificationService,
    MfaCryptoService,
    MfaService,
    PasswordHasherService,
    TotpService
  ]
})
export class AuthModule {}
