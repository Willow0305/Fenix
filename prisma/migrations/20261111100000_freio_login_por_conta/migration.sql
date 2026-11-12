-- Freio de tentativas de login por conta (PEN-053, DT-109): falhas seguidas por hash do e-mail.
-- CreateTable
CREATE TABLE "login_failure_counters" (
    "id" UUID NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "failures" INTEGER NOT NULL,
    "last_failure_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "login_failure_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_failure_counters_key_hash_key" ON "login_failure_counters"("key_hash");

-- CreateIndex
CREATE INDEX "login_failure_counters_last_failure_at_idx" ON "login_failure_counters"("last_failure_at");

