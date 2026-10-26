import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AppConfig, loadS3 } from '../common/config/app-config';
import { LocalObjectStorage, ObjectNotFoundError } from '../common/storage/object-storage';
import { S3ObjectStorage } from '../common/storage/s3-object-storage';

/**
 * Copia os arquivos do disco (`STORAGE_LOCAL_DIR`) para o S3 (DT-053). Cada arquivo é lido,
 * conferido pelo SHA-256 guardado no banco, enviado, lido de volta e conferido de novo; só
 * então o registro passa a apontar para o S3. Pode ser repetido: o que já foi migrado não é
 * tocado. Rode com `STORAGE_DRIVER=local` e as variáveis `S3_*` preenchidas; depois troque
 * para `STORAGE_DRIVER=s3`.
 *
 * Uso: npm run storage:migrate [-- --simular]
 */
const sha256 = (content: Buffer) => createHash('sha256').update(content).digest('hex');

async function main(): Promise<void> {
  const simulate = process.argv.includes('--simular');
  const config = new AppConfig();
  const local = new LocalObjectStorage(config);
  const s3 = new S3ObjectStorage(loadS3(process.env, config.values.isProduction));
  const prisma = new PrismaClient();
  const totals = { migrated: 0, missing: 0, corrupted: 0, failed: 0 };

  try {
    const files = await prisma.mediaFile.findMany({
      where: { storageProvider: 'local' },
      select: { id: true, objectKey: true, checksumSha256: true },
      orderBy: { createdAt: 'asc' }
    });

    console.log(
      `${files.length} arquivo(s) no disco. ${simulate ? 'Simulação: nada será enviado.' : ''}`
    );

    for (const file of files) {
      let content: Buffer;

      try {
        content = await local.get(file.objectKey);
      } catch (error) {
        totals[error instanceof ObjectNotFoundError ? 'missing' : 'failed'] += 1;
        console.warn(`Sem arquivo no disco: ${file.id}`);
        continue;
      }

      if (sha256(content) !== file.checksumSha256) {
        totals.corrupted += 1;
        console.warn(`Conteúdo diferente do registrado (não migrado): ${file.id}`);
        continue;
      }

      if (simulate) {
        totals.migrated += 1;
        continue;
      }

      try {
        await s3.put(file.objectKey, content);

        if (sha256(await s3.get(file.objectKey)) !== file.checksumSha256) {
          throw new Error('conferência após o envio falhou');
        }

        await prisma.mediaFile.update({
          where: { id: file.id },
          data: { storageProvider: s3.provider, bucket: s3.bucket }
        });
        totals.migrated += 1;
      } catch (error) {
        totals.failed += 1;
        console.warn(
          `Falha ao migrar ${file.id}: ${error instanceof Error ? error.message : 'erro'}`
        );
      }
    }

    console.log(
      `${simulate ? 'Prontos para migrar' : 'Migrados'}: ${totals.migrated}. Sem arquivo: ${totals.missing}. ` +
        `Conteúdo divergente: ${totals.corrupted}. Falhas: ${totals.failed}.`
    );

    if (totals.failed > 0 || totals.corrupted > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha na migração dos arquivos.');
  process.exitCode = 1;
});
