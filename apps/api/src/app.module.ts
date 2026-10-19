import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // Desligável apenas fora de produção, para suítes de integração que fazem muitos logins.
      skipIf: () =>
        process.env['NODE_ENV'] !== 'production' && process.env['THROTTLE_DISABLED'] === 'true'
    }),
    CommonModule,
    HealthModule,
    AuthModule,
    AccessModule,
    MediaModule,
    SettingsModule
  ]
})
export class AppModule {}
