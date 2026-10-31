import { AppError } from '../../../common/errors/app-error';
import type { PrismaService, PrismaTx } from '../../../common/prisma/prisma.service';

/**
 * Celular único entre as contas (DT-084). Recusa com mensagem clara antes de gravar; o
 * índice único do banco segura dois cadastros simultâneos com o mesmo número.
 */
export async function assertPhoneAvailable(
  db: PrismaService | PrismaTx,
  phone: string | null,
  message: string,
  exceptUserId?: string
): Promise<void> {
  if (phone === null) {
    return;
  }

  const owner = await db.user.findUnique({ where: { phone }, select: { id: true } });

  if (owner !== null && owner.id !== exceptUserId) {
    throw AppError.conflict('PHONE_IN_USE', message);
  }
}
