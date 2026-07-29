import { Global, Module } from '@nestjs/common';

import { RateLimitConfig } from './rate-limit.config';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  exports: [RateLimitConfig, RateLimitGuard, RateLimitService],
  providers: [RateLimitConfig, RateLimitGuard, RateLimitService]
})
export class RateLimitModule {}
