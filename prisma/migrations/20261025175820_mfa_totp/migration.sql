-- Altera enum
ALTER TYPE "UserTokenType" ADD VALUE 'MFA_CHALLENGE';

-- Altera tabela
ALTER TABLE "user_sessions" ADD COLUMN     "mfa_verified_at" TIMESTAMPTZ(6);

-- Altera tabela
ALTER TABLE "user_tokens" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- Altera tabela
ALTER TABLE "users" ADD COLUMN     "mfa_enabled_at" TIMESTAMPTZ(6),
ADD COLUMN     "mfa_last_used_step" INTEGER,
ADD COLUMN     "mfa_pending_secret_encrypted" TEXT,
ADD COLUMN     "mfa_secret_encrypted" TEXT;

-- Cria tabela
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key" ON "mfa_recovery_codes"("code_hash");

-- Cria índice
CREATE INDEX "mfa_recovery_codes_user_id_used_at_idx" ON "mfa_recovery_codes"("user_id", "used_at");

-- Adiciona chave estrangeira
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
