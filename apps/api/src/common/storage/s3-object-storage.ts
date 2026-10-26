import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

import type { S3StorageConfig } from '../config/app-config';
import { ObjectNotFoundError, ObjectStorage, SAFE_KEY } from './object-storage';

/** Cliente S3 a partir da configuração (AWS, MinIO, Cloudflare R2, Backblaze B2…). */
export function s3ClientFor(config: S3StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
          }
        }
      : {})
  });
}

/**
 * Armazenamento de objetos compatível com S3 (R-11, DT-053). Arquivos privados: o bucket
 * não é público e a API continua sendo a única porta de leitura, com autorização. Use
 * versionamento no bucket para recuperar arquivos apagados ou sobrescritos.
 */
@Injectable()
export class S3ObjectStorage extends ObjectStorage {
  readonly provider = 's3';
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    super();
    this.bucket = config.bucket;
    this.client = s3ClientFor(config);
  }

  private assertKey(objectKey: string): void {
    if (!SAFE_KEY.test(objectKey) || objectKey.includes('..')) {
      throw new Error('Chave de objeto inválida.');
    }
  }

  async put(objectKey: string, content: Buffer): Promise<void> {
    this.assertKey(objectKey);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: content,
        ContentLength: content.length,
        ...(this.config.serverSideEncryption ? { ServerSideEncryption: 'AES256' } : {})
      })
    );
  }

  async get(objectKey: string): Promise<Buffer> {
    this.assertKey(objectKey);

    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey })
      );

      if (!result.Body) {
        throw new ObjectNotFoundError(objectKey);
      }

      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
      ) {
        throw new ObjectNotFoundError(objectKey);
      }

      throw error;
    }
  }
}
