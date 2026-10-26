import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { DataClassification, MediaKind } from '../../../generated/prisma/client';

import { AppError } from '../../../common/errors/app-error';
import type { Principal } from '../../../common/http/request-context';
import { PrismaService, type PrismaTx } from '../../../common/prisma/prisma.service';
import {
  detectFileType,
  type DetectedFileType,
  EXTENSIONS_BY_TYPE,
  extensionOf,
  sanitizeFileName
} from '../../../common/storage/file-signature';
import {
  ImageDecodeError,
  type ImageOptimization,
  optimizeImage
} from '../../../common/storage/image-processing';
import { ObjectNotFoundError, ObjectStorage } from '../../../common/storage/object-storage';
import { PERMISSIONS } from '../../access/domain/permission-catalog';

export interface UploadPolicy {
  readonly allowedTypes: readonly DetectedFileType[];
  readonly maxBytes: number;
  readonly kind: MediaKind;
  readonly classification: DataClassification;
  /** Quando presente, a imagem é otimizada e gravada em WebP (DT-039). */
  readonly optimize?: ImageOptimization;
}

/**
 * Imagens públicas (logos, capas, produtos): aceitas até 10 MB porque são reduzidas e
 * convertidas para WebP antes de gravar. Comprovantes e contratos usam DOCUMENT_POLICY e
 * são gravados sem alteração, por serem documentos de prova.
 */
export const IMAGE_POLICY: Omit<UploadPolicy, 'classification' | 'kind'> = {
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 10 * 1024 * 1024,
  optimize: { maxWidth: 1920, maxHeight: 1920 }
};

export const DOCUMENT_POLICY: Omit<UploadPolicy, 'classification' | 'kind'> = {
  allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  maxBytes: 10 * 1024 * 1024
};

export interface IncomingFile {
  readonly buffer: Buffer;
  readonly originalname: string;
  readonly size: number;
}

export interface StoredFile {
  readonly id: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly url: string;
}

export function mediaUrl(id: string): string {
  return `/api/v1/media/${id}`;
}

/** Upload e leitura de arquivos (RN-ARQ-001/002). O binário nunca vai ao banco. */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage
  ) {}

  async store(
    file: IncomingFile | undefined,
    policy: UploadPolicy,
    uploadedById: string | null,
    tx?: PrismaTx
  ): Promise<StoredFile> {
    if (file === undefined || file.size === 0) {
      throw AppError.validation('FILE_REQUIRED', 'Selecione um arquivo.');
    }

    if (file.size > policy.maxBytes) {
      throw new AppError(
        'PAYLOAD_TOO_LARGE',
        'FILE_TOO_LARGE',
        `O arquivo excede o limite de ${Math.round(policy.maxBytes / 1024 / 1024)} MB.`
      );
    }

    const detected = detectFileType(file.buffer);
    const extension = extensionOf(file.originalname);

    if (
      detected === null ||
      !policy.allowedTypes.includes(detected) ||
      extension === null ||
      !EXTENSIONS_BY_TYPE[detected].includes(extension)
    ) {
      throw new AppError(
        'UNSUPPORTED_MEDIA_TYPE',
        'FILE_TYPE_NOT_ALLOWED',
        'Tipo de arquivo não permitido ou conteúdo incompatível com a extensão.'
      );
    }

    const content = await this.prepare(file.buffer, detected, extension, policy);
    const now = new Date();
    const objectKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${content.extension}`;
    const checksum = createHash('sha256').update(content.buffer).digest('hex');

    await this.storage.put(objectKey, content.buffer);

    const record = await (tx ?? this.prisma).mediaFile.create({
      data: {
        storageProvider: this.storage.provider,
        bucket: this.storage.bucket,
        objectKey,
        originalName: sanitizeFileName(file.originalname),
        mimeType: content.mimeType,
        extension: content.extension,
        sizeBytes: BigInt(content.buffer.length),
        checksumSha256: checksum,
        kind: policy.kind,
        classification: policy.classification,
        isVerified: true,
        verifiedAt: now,
        uploadedById
      },
      select: { id: true }
    });

    return {
      id: record.id,
      mimeType: content.mimeType,
      sizeBytes: content.buffer.length,
      url: mediaUrl(record.id)
    };
  }

  /** Otimiza imagens quando a política pede; demais arquivos seguem sem alteração. */
  private async prepare(
    buffer: Buffer,
    detected: DetectedFileType,
    extension: string,
    policy: UploadPolicy
  ): Promise<{ buffer: Buffer; mimeType: DetectedFileType; extension: string }> {
    if (policy.optimize === undefined || !detected.startsWith('image/')) {
      return { buffer, mimeType: detected, extension };
    }

    try {
      const optimized = await optimizeImage(buffer, policy.optimize);

      return { buffer: optimized.buffer, mimeType: 'image/webp', extension: 'webp' };
    } catch (error) {
      if (error instanceof ImageDecodeError) {
        throw AppError.validation('IMAGE_UNREADABLE', error.message);
      }

      throw error;
    }
  }

  /**
   * Leitura: arquivos PUBLIC são abertos; demais exigem `files.read.restricted`
   * ou a autorização de domínio informada pelo chamador (`allowOwner`).
   */
  async read(
    id: string,
    principal: Principal | undefined,
    allowOwner = false
  ): Promise<{ content: Buffer; mimeType: string; fileName: string; isPublic: boolean }> {
    const media = await this.prisma.mediaFile.findFirst({
      where: { id, deletedAt: null },
      select: {
        objectKey: true,
        mimeType: true,
        originalName: true,
        classification: true,
        uploadedById: true
      }
    });

    if (media === null) {
      throw AppError.notFound('Arquivo não encontrado.');
    }

    const isPublic = media.classification === 'PUBLIC';
    const permitted =
      isPublic ||
      allowOwner ||
      (principal !== undefined &&
        (principal.permissions.has(PERMISSIONS.filesReadRestricted) ||
          media.uploadedById === principal.userId));

    if (!permitted) {
      throw AppError.notFound('Arquivo não encontrado.');
    }

    let content: Buffer;

    try {
      content = await this.storage.get(media.objectKey);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        // Metadado sem objeto: o arquivo foi removido do armazenamento fora do sistema.
        throw AppError.notFound('Arquivo não encontrado.');
      }

      throw error;
    }

    return {
      content,
      mimeType: media.mimeType,
      fileName: media.originalName,
      isPublic
    };
  }
}
