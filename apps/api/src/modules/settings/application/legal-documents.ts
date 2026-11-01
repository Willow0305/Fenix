import { AppError } from '../../../common/errors/app-error';
import type { PrismaService, PrismaTx } from '../../../common/prisma/prisma.service';
import {
  LEGAL_DOCUMENTS,
  type LegalField,
  type LegalKind,
  nextLegalVersion,
  publishedText
} from '../domain/legal-documents';

type Client = PrismaService | PrismaTx;

/** Versão em vigor mostrada no site e conferida no aceite (DT-089). */
export interface LegalVersionView {
  readonly id: string;
  readonly version: number;
  readonly publishedAt: string;
}

export type LegalVersions = Record<LegalField, LegalVersionView | null>;

async function latest(client: Client, kind: LegalKind) {
  return client.legalDocumentVersion.findFirst({
    where: { kind },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, contentHash: true, publishedAt: true }
  });
}

/**
 * Versões em vigor: a última de cada documento, desde que o texto continue publicado nas
 * configurações (texto apagado = documento fora do ar, sem versão a aceitar).
 */
export async function currentLegalVersions(
  client: Client,
  texts: Record<LegalField, string | null>
): Promise<LegalVersions> {
  const entries = await Promise.all(
    LEGAL_DOCUMENTS.map(async ({ kind, field }) => {
      const row = publishedText(texts[field]) === null ? null : await latest(client, kind);

      return [
        field,
        row === null
          ? null
          : { id: row.id, version: row.version, publishedAt: row.publishedAt.toISOString() }
      ] as const;
    })
  );

  return Object.fromEntries(entries) as LegalVersions;
}

/** Textos publicados nas configurações, para saber as versões em vigor. */
export async function publishedLegalTexts(
  client: Client
): Promise<Record<LegalField, string | null>> {
  const settings = await client.teamSettings.findUnique({
    where: { singletonKey: 'default' },
    select: { termsOfUse: true, privacyPolicy: true }
  });

  return {
    termsOfUse: settings?.termsOfUse ?? null,
    privacyPolicy: settings?.privacyPolicy ?? null
  };
}

/**
 * Versões em vigor que a conta ainda não aceitou (DT-094): quem já tem conta aceita de novo
 * quando os termos ou a política mudam. Conta antiga, sem aceite registrado, também entra.
 */
export async function pendingLegalVersions(
  client: Client,
  userId: string
): Promise<(LegalVersionView & { readonly field: LegalField })[]> {
  const current = await currentLegalVersions(client, await publishedLegalTexts(client));
  const ids = LEGAL_DOCUMENTS.flatMap(({ field }) => {
    const version = current[field];

    return version === null ? [] : [version.id];
  });

  if (ids.length === 0) {
    return [];
  }

  const accepted = new Set(
    (
      await client.legalAcceptance.findMany({
        where: { userId, documentVersionId: { in: ids } },
        select: { documentVersionId: true }
      })
    ).map((row) => row.documentVersionId)
  );

  return LEGAL_DOCUMENTS.flatMap(({ field }) => {
    const version = current[field];

    return version === null || accepted.has(version.id) ? [] : [{ field, ...version }];
  });
}

/** Cria uma versão imutável para cada texto que mudou; devolve as versões criadas. */
export async function publishLegalVersions(
  tx: PrismaTx,
  texts: Partial<Record<LegalField, string | null>>,
  publishedByUserId: string
): Promise<{ id: string; kind: LegalKind; version: number; contentHash: string }[]> {
  const created: { id: string; kind: LegalKind; version: number; contentHash: string }[] = [];

  for (const { kind, field } of LEGAL_DOCUMENTS) {
    if (!(field in texts)) {
      continue;
    }

    const next = nextLegalVersion(texts[field], await latest(tx, kind));

    if (next !== null) {
      const row = await tx.legalDocumentVersion.create({
        data: { kind, ...next, publishedByUserId },
        select: { id: true }
      });

      created.push({ id: row.id, kind, version: next.version, contentHash: next.contentHash });
    }
  }

  return created;
}

/**
 * Registra o aceite das versões em vigor. Quem aceitou precisa ter visto exatamente a versão
 * atual: se o texto mudou enquanto a pessoa preenchia, ela relê antes de continuar.
 */
export async function acceptLegalVersions(
  tx: PrismaTx,
  userId: string,
  current: LegalVersions,
  accepted: Partial<Record<LegalField, string | undefined>>,
  context: 'SIGNUP' | 'UPDATE'
): Promise<Record<LegalField, number | null>> {
  const changed = LEGAL_DOCUMENTS.some(
    ({ field }) => current[field] !== null && current[field]?.id !== accepted[field]
  );

  if (changed) {
    throw AppError.conflict(
      'LEGAL_VERSION_CHANGED',
      'Os termos de uso ou a política de privacidade foram atualizados. Releia e aceite novamente.'
    );
  }

  const versions = LEGAL_DOCUMENTS.flatMap(({ field }) => {
    const version = current[field];

    return version === null ? [] : [version.id];
  });

  if (versions.length > 0) {
    // Versão já aceita antes (aceite repetido) não duplica: um aceite por conta e versão.
    await tx.legalAcceptance.createMany({
      data: versions.map((documentVersionId) => ({ userId, documentVersionId, context })),
      skipDuplicates: true
    });
  }

  return {
    termsOfUse: current.termsOfUse?.version ?? null,
    privacyPolicy: current.privacyPolicy?.version ?? null
  };
}
