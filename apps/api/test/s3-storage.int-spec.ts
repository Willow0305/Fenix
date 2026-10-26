import { randomUUID } from 'node:crypto';

import { CreateBucketCommand } from '@aws-sdk/client-s3';

import type { S3StorageConfig } from '../src/common/config/app-config';
import { ObjectNotFoundError } from '../src/common/storage/object-storage';
import { s3ClientFor, S3ObjectStorage } from '../src/common/storage/s3-object-storage';

/**
 * Adaptador S3 contra um serviço real (DT-053). Roda só com `S3_TEST_ENDPOINT` definido
 * (ex.: SeaweedFS ou MinIO local); sem ele, fica pulado.
 */
const endpoint = process.env['S3_TEST_ENDPOINT'];
const describeS3 = endpoint ? describe : describe.skip;

describeS3('Armazenamento S3 (DT-053)', () => {
  const config: S3StorageConfig = {
    bucket: `fenix-teste-${randomUUID().slice(0, 8)}`,
    region: 'us-east-1',
    endpoint: endpoint ?? null,
    forcePathStyle: true,
    accessKeyId: 'teste',
    secretAccessKey: 'teste-segredo',
    serverSideEncryption: false
  };
  const storage = new S3ObjectStorage(config);

  beforeAll(async () => {
    await s3ClientFor(config).send(new CreateBucketCommand({ Bucket: config.bucket }));
  });

  it('grava e lê o mesmo conteúdo', async () => {
    const content = Buffer.from(`foto ${randomUUID()}`);

    await storage.put('2026/10/foto.webp', content);

    expect(await storage.get('2026/10/foto.webp')).toEqual(content);
    expect(storage.provider).toBe('s3');
  });

  it('objeto ausente vira ObjectNotFoundError (a API responde 404)', async () => {
    await expect(storage.get('2026/10/nao-existe.webp')).rejects.toBeInstanceOf(
      ObjectNotFoundError
    );
  });

  it('recusa chave que tenta sair do padrão', async () => {
    await expect(storage.put('../segredo', Buffer.from('x'))).rejects.toThrow(
      'Chave de objeto inválida.'
    );
  });
});
