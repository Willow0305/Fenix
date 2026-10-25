const { testDatabaseUrl } = require('./test-database.cjs');

/** Executado antes de cada arquivo de teste: todo PrismaClient criado aponta para o banco de testes. */
process.env.DATABASE_URL = testDatabaseUrl().url;
