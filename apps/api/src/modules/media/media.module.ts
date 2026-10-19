import { Global, Module } from '@nestjs/common';

import { MediaService } from './application/media.service';
import { MediaController } from './http/media.controller';

@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService]
})
export class MediaModule {}
