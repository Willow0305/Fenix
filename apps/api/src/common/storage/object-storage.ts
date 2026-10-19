import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { Injectable } from '@nestjs/common';

import { AppConfig } from '../config/app-config';

/** Porta de armazenamento de objetos (DT-010, DT-024). O banco guarda apenas metadados. */
export abstract class ObjectStorage {
  abstract readonly provider: string;
  abstract readonly bucket: string;
  abstract put(objectKey: string, content: Buffer): Promise<void>;
  abstract get(objectKey: string): Promise<Buffer>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,480}$/;

/** Adaptador local para desenvolvimento: arquivos em `STORAGE_LOCAL_DIR`. */
@Injectable()
export class LocalObjectStorage extends ObjectStorage {
  readonly provider = 'local';
  readonly bucket = 'fenix';

  constructor(private readonly config: AppConfig) {
    super();
  }

  private pathFor(objectKey: string): string {
    if (!SAFE_KEY.test(objectKey) || objectKey.includes('..')) {
      throw new Error('Chave de objeto inválida.');
    }

    const root = resolve(this.config.values.storageLocalDir);
    const full = resolve(join(root, objectKey));

    if (!full.startsWith(root + sep)) {
      throw new Error('Chave de objeto fora do diretório permitido.');
    }

    return full;
  }

  async put(objectKey: string, content: Buffer): Promise<void> {
    const path = this.pathFor(objectKey);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async get(objectKey: string): Promise<Buffer> {
    return readFile(this.pathFor(objectKey));
  }
}
