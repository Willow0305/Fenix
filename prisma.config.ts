import { defineConfig, env } from 'prisma/config';

/**
 * Configuração do Prisma 7 (DT-054). O `.env` não é carregado sozinho: os scripts do
 * projeto já rodam o Prisma com `dotenv -e .env`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Gerar o cliente não precisa de banco (ex.: construção da imagem Docker).
  ...(process.env['DATABASE_URL'] ? { datasource: { url: env('DATABASE_URL') } } : {})
});
