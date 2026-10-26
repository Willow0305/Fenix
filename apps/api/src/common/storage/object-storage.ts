import { constants } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AppConfig } from '../config/app-config';

/** Porta de armazenamento de objetos (DT-010, DT-024). O banco guarda apenas metadados. */
export abstract class ObjectStorage {
  abstract readonly provider: string;
  abstract readonly bucket: string;
  abstract put(objectKey: string, content: Buffer): Promise<void>;
  /** Lança `ObjectNotFoundError` quando o objeto não existe mais no armazenamento. */
  abstract get(objectKey: string): Promise<Buffer>;
}

export class ObjectNotFoundError extends Error {}

export const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,480}$/;

/**
 * Adaptador de disco: arquivos em `STORAGE_LOCAL_DIR`, que deve ficar fora da pasta do
 * projeto (em produção, um volume persistente com caminho absoluto; DT-038).
 */
@Injectable()
export class LocalObjectStorage extends ObjectStorage implements OnModuleInit {
  readonly provider = 'local';
  readonly bucket = 'fenix';

  constructor(private readonly config: AppConfig) {
    super();
  }

  /** Falha na inicialização se a pasta não puder ser gravada, em vez de perder uploads. */
  async onModuleInit(): Promise<void> {
    const root = resolve(this.config.values.storageLocalDir);

    await mkdir(root, { recursive: true });

    try {
      await access(root, constants.R_OK | constants.W_OK);
    } catch {
      throw new Error(`STORAGE_LOCAL_DIR sem permissão de leitura e escrita: ${root}`);
    }

    const logger = new Logger('Arquivos');

    logger.log(`Arquivos guardados em ${root}.`);

    // Pasta dentro do projeto se perde em novo clone ou limpeza (DT-038).
    if (
      root.startsWith(resolve(process.cwd()) + sep) ||
      root.includes(`${sep}apps${sep}api${sep}`)
    ) {
      logger.warn(
        'STORAGE_LOCAL_DIR aponta para dentro do projeto. Use um caminho absoluto fora dele, ' +
          'e reinicie o servidor depois de mudar o .env.'
      );
    }
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
    // Grava em arquivo temporário e renomeia: uma queda no meio não deixa arquivo pela metade.
    const temporary = `${path}.${process.pid}.tmp`;

    await writeFile(temporary, content);
    await rename(temporary, path);
  }

  async get(objectKey: string): Promise<Buffer> {
    try {
      return await readFile(this.pathFor(objectKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ObjectNotFoundError(objectKey);
      }

      throw error;
    }
  }
}
