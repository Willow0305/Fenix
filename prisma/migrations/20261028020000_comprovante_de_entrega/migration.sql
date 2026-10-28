-- Comprovante de entrega (DT-075 etapa 2): entregadores, saídas, código e "não recebi".

-- CreateEnum
CREATE TYPE "CourierKind" AS ENUM ('STAFF', 'OWN_COURIER', 'APP');

-- CreateEnum
CREATE TYPE "DeliveryProofKind" AS ENUM ('CODE', 'BUYER_RECEIPT', 'PHOTO', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('OUT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_code_encrypted" TEXT,
ADD COLUMN     "delivery_proof_kind" "DeliveryProofKind",
ADD COLUMN     "not_received_at" TIMESTAMPTZ(6),
ADD COLUMN     "not_received_note" TEXT,
ADD COLUMN     "not_received_resolution" VARCHAR(20),
ADD COLUMN     "not_received_resolved_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "couriers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "CourierKind" NOT NULL,
    "phone" VARCHAR(30),
    "vehicle" VARCHAR(60),
    "plate" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "courier_id" UUID,
    "courier_kind" "CourierKind",
    "courier_name" VARCHAR(120),
    "courier_phone" VARCHAR(30),
    "vehicle" VARCHAR(60),
    "plate" VARCHAR(10),
    "notes" VARCHAR(500),
    "status" "DeliveryAttemptStatus" NOT NULL DEFAULT 'OUT',
    "link_token_hash" CHAR(64),
    "link_expires_at" TIMESTAMPTZ(6),
    "code_attempts" SMALLINT NOT NULL DEFAULT 0,
    "received_by" VARCHAR(120),
    "proof_media_file_id" UUID,
    "failure_reason" TEXT,
    "dispatched_by_id" UUID,
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "couriers_is_active_deleted_at_idx" ON "couriers"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_link_token_hash_key" ON "delivery_attempts"("link_token_hash");

-- CreateIndex
CREATE INDEX "delivery_attempts_order_id_dispatched_at_idx" ON "delivery_attempts"("order_id", "dispatched_at");

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_proof_media_file_id_fkey" FOREIGN KEY ("proof_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_dispatched_by_id_fkey" FOREIGN KEY ("dispatched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Uma saída em andamento por pedido.
CREATE UNIQUE INDEX "delivery_attempts_one_out_key"
  ON "delivery_attempts"("order_id") WHERE "status" = 'OUT';
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_code_attempts_check"
  CHECK ("code_attempts" >= 0);
