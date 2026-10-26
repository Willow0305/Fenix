import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
import { PostgresThrottlerStorage } from './common/http/postgres-throttler-storage';
import { HealthModule } from './health/health.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { CampaignsModule } from './modules/campaigns/http/campaigns.controller';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PrivacyModule } from './modules/privacy/http/privacy.controller';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReportsModule } from './modules/reports/http/reports.controller';
import { SettingsModule } from './modules/settings/settings.module';
import { SportsModule } from './modules/sports/sports.module';
import { StoreModule } from './modules/store/store.module';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [PostgresThrottlerStorage],
      useFactory: (shared: PostgresThrottlerStorage) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        // Contagem no PostgreSQL, comum a todos os servidores (DT-047); `memory` só para
        // desenvolvimento com um servidor.
        ...(process.env['THROTTLE_STORE'] === 'memory' ? {} : { storage: shared }),
        // Desligável apenas fora de produção, para suítes de integração que fazem muitos logins.
        skipIf: () =>
          process.env['NODE_ENV'] !== 'production' && process.env['THROTTLE_DISABLED'] === 'true'
      })
    }),
    CommonModule,
    HealthModule,
    AuthModule,
    AccessModule,
    MediaModule,
    NotificationsModule,
    SettingsModule,
    SportsModule,
    FinanceModule,
    StoreModule,
    CampaignsModule,
    PartnersModule,
    ContentModule,
    ReportsModule,
    PrivacyModule,
    DashboardModule,
    RealtimeModule
  ]
})
export class AppModule {}
