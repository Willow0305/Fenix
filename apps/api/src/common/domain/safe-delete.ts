import type { AuditService } from '../audit/audit.service';
import { AppError } from '../errors/app-error';
import type { Principal, RequestMeta } from '../http/request-context';
import type { PrismaService, PrismaTx } from '../prisma/prisma.service';

/** Uso que impede a exclusão, ex.: `{ count: 3, label: 'equipe(s)' }`. */
export interface UsageCount {
  readonly count: number;
  readonly label: string;
}

/**
 * Exclusão lógica de cadastro auxiliar (categorias, centros de custo, planos) somente
 * quando nada o usa (docs/29 COR-022, AGENTS.md: preferir `deletedAt`). Se estiver em
 * uso, responde 409 dizendo onde e sugerindo inativar, que preserva o histórico.
 */
export async function softDeleteIfUnused(options: {
  readonly prisma: PrismaService;
  readonly audit: AuditService;
  readonly actor: Principal;
  readonly meta: RequestMeta;
  readonly reason: string;
  readonly entityType: string;
  readonly action: string;
  /** Nome no texto da mensagem, ex.: "a categoria". */
  readonly noun: string;
  readonly load: (tx: PrismaTx) => Promise<{ name: string } | null>;
  readonly usage: (tx: PrismaTx) => Promise<readonly UsageCount[]>;
  readonly remove: (tx: PrismaTx) => Promise<unknown>;
  readonly entityId: string;
}): Promise<void> {
  await options.prisma.$transaction(async (tx) => {
    const current = await options.load(tx);

    if (current === null) {
      throw AppError.notFound('Registro não encontrado.');
    }

    const inUse = (await options.usage(tx)).filter((item) => item.count > 0);

    if (inUse.length > 0) {
      const where = inUse.map((item) => `${item.count} ${item.label}`).join(', ');

      throw AppError.conflict(
        'IN_USE',
        `Não é possível excluir ${options.noun} "${current.name}": em uso por ${where}. Inative para esconder sem perder o histórico.`
      );
    }

    await options.remove(tx);
    await options.audit.record(
      {
        actorUserId: options.actor.userId,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        reason: options.reason,
        before: { name: current.name },
        meta: options.meta
      },
      tx
    );
  });
}
