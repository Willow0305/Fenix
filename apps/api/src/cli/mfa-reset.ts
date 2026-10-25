import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { MfaService } from '../modules/auth/application/mfa.service';
import { normalizeEmail } from '../modules/auth/domain/auth-rules';

/**
 * Emergência (DT-037): remove a segunda etapa de uma conta quando ninguém com permissão
 * consegue entrar no painel — por exemplo, o único administrador perdeu o celular e os
 * códigos de recuperação. Exige acesso ao servidor e ao banco; fica registrado na auditoria.
 *
 * Uso: npm run mfa:reset -- <e-mail> "<motivo>"
 */
async function main(): Promise<void> {
  const [email, reason] = process.argv.slice(2);

  if (!email || !reason || reason.trim().length < 3) {
    throw new Error('Uso: npm run mfa:reset -- <e-mail> "<motivo com ao menos 3 caracteres>"');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const user = await app.get(PrismaService).user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true }
    });

    if (user === null) {
      throw new Error('Nenhuma conta com esse e-mail.');
    }

    await app.get(MfaService).resetFor(null, user.id, `CLI: ${reason.trim()}`, null);
    console.log(
      'Segunda etapa removida e sessões encerradas. A conta deve ativá-la de novo no próximo login.'
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao redefinir a segunda etapa.');
  process.exitCode = 1;
});
