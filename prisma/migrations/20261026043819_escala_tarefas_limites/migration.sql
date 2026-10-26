-- DT-047 (R-04): tarefas automáticas em um só servidor por vez e limite de requisições
-- compartilhado entre servidores.

-- Cria enum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- Cria tabela
CREATE TABLE "scheduled_job_leases" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "holder" VARCHAR(160) NOT NULL,
    "locked_until" TIMESTAMPTZ(6) NOT NULL,
    "last_started_at" TIMESTAMPTZ(6) NOT NULL,
    "last_finished_at" TIMESTAMPTZ(6),
    "last_status" "ScheduledJobStatus",
    "last_error" VARCHAR(200),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_job_leases_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "rate_limit_buckets" (
    "id" UUID NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "hits" INTEGER NOT NULL,
    "window_ends_at" TIMESTAMPTZ(6) NOT NULL,
    "blocked_until" TIMESTAMPTZ(6),

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE UNIQUE INDEX "scheduled_job_leases_name_key" ON "scheduled_job_leases"("name");

-- Cria índice
CREATE UNIQUE INDEX "rate_limit_buckets_key_key" ON "rate_limit_buckets"("key");

-- Cria índice
CREATE INDEX "rate_limit_buckets_window_ends_at_idx" ON "rate_limit_buckets"("window_ends_at");

-- Contagem nunca negativa.
ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_hits_check" CHECK ("hits" >= 0);
