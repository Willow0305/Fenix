import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { OptionalPrincipal, type Principal } from '../../../common/http/request-context';
import { Public } from '../../auth/http/auth.decorators';
import { MediaService } from '../application/media.service';

@ApiTags('Arquivos')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Público para arquivos PUBLIC; demais exigem autorização (404 para não revelar existência). */
  @Get(':id')
  @Public()
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @OptionalPrincipal() principal: Principal | undefined,
    @Res() res: Response
  ): Promise<void> {
    const file = await this.media.read(id, principal);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader(
      'Content-Disposition',
      `${file.mimeType === 'application/pdf' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
    res.setHeader('Cache-Control', file.isPublic ? 'public, max-age=300' : 'private, no-store');
    res.send(file.content);
  }
}
