-- Cria enum
CREATE TYPE "PrivacyRequestType" AS ENUM ('DATA_EXPORT', 'ERASURE');

-- Cria enum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- Cria tabela
CREATE TABLE "privacy_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "details" TEXT,
    "resolution" TEXT,
    "handled_by_id" UUID,
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE INDEX "privacy_requests_status_created_at_idx" ON "privacy_requests"("status", "created_at");

-- Cria índice
CREATE INDEX "privacy_requests_user_id_created_at_idx" ON "privacy_requests"("user_id", "created_at");

-- Cria índice
CREATE INDEX "audit_logs_action_occurred_at_idx" ON "audit_logs"("action", "occurred_at");

-- Cria índice
CREATE INDEX "notifications_deduplication_key_idx" ON "notifications"("deduplication_key");

-- Cria índice
CREATE INDEX "orders_status_paid_at_idx" ON "orders"("status", "paid_at");

-- Adiciona chave estrangeira
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

