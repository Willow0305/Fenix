import { Global, Module } from '@nestjs/common';

import { ApplicationConfig } from './application.config';

@Global()
@Module({
  exports: [ApplicationConfig],
  providers: [ApplicationConfig]
})
export class ConfigModule {}
