import { AppError } from '../../../common/errors/app-error';
import type { PrismaService, PrismaTx } from '../../../common/prisma/prisma.service';

/**
 * Equipe escolhida para algo novo (partida, comunicado, seletiva) precisa existir e estar
 * ativa (docs/29 §3.9, COR-008). `keepTeamId` permite manter a equipe que o registro já
 * tinha, mesmo que ela tenha sido inativada depois: editar não apaga o vínculo antigo.
 */
export async function assertActiveTeam(
  db: PrismaService | PrismaTx,
  teamId: string | null | undefined,
  keepTeamId: string | null = null
): Promise<void> {
  if (!teamId || teamId === keepTeamId) {
    return;
  }

  const team = await db.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: { isActive: true }
  });

  if (team === null || !team.isActive) {
    throw AppError.validation('INVALID_TEAM', 'Equipe inexistente ou inativa.', [
      { field: 'teamId', code: 'INVALID_TEAM', message: 'Escolha uma equipe ativa.' }
    ]);
  }
}
