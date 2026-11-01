import { ageOn, dateToCivil, todayIn } from '../../../common/domain/civil-date';
import type { PrismaService, PrismaTx } from '../../../common/prisma/prisma.service';

/** Idade a partir da qual a pessoa tem conta própria sem restrições (DT-088). */
export const ADULT_ACCOUNT_AGE = 18;

/**
 * Conta de menor (DT-092): vinculada a atleta menor de 18 anos, criada pela diretoria com a
 * declaração do responsável. Não participa do fórum e o perfil fica privado. A restrição
 * acaba sozinha quando o atleta completa 18 anos. Atleta sem nascimento conta como menor.
 */
export async function isMinorAccount(
  client: PrismaService | PrismaTx,
  userId: string
): Promise<boolean> {
  const athlete = await client.athlete.findFirst({
    where: { userId, deletedAt: null },
    select: { birthDate: true }
  });

  if (athlete === null) {
    return false;
  }

  return (
    athlete.birthDate === null ||
    ageOn(dateToCivil(athlete.birthDate), todayIn()) < ADULT_ACCOUNT_AGE
  );
}
