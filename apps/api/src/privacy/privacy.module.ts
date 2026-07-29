import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { RetentionConfig } from './retention.config';

@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, RetentionConfig]
})
export class PrivacyModule {}
