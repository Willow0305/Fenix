-- DT-050: navegadores lembrados na segunda etapa do login (só o hash do token).

-- Cria tabela
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(120),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");

-- Cria índice
CREATE INDEX "trusted_devices_user_id_revoked_at_expires_at_idx" ON "trusted_devices"("user_id", "revoked_at", "expires_at");

-- Adiciona chave estrangeira
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Validade sempre posterior à criação.
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_expires_check" CHECK ("expires_at" > "created_at");
