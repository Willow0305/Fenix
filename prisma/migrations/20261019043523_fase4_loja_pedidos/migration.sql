-- Altera tabela
ALTER TABLE "orders" ADD COLUMN     "guest_access_token_hash" CHAR(64),
ADD COLUMN     "reservation_expires_at" TIMESTAMPTZ(6);

-- Cria índice
CREATE UNIQUE INDEX "orders_guest_access_token_hash_key" ON "orders"("guest_access_token_hash");

-- Cria índice
CREATE INDEX "orders_status_reservation_expires_at_idx" ON "orders"("status", "reservation_expires_at");

