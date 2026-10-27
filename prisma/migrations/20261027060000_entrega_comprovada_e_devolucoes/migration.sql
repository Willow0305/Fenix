-- Entrega comprovada, desistência e defeito (DT-070).
-- CreateEnum
CREATE TYPE "ReturnKind" AS ENUM ('WITHDRAWAL', 'DEFECT');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('OPEN', 'AWAITING_ITEM', 'REFUNDED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'EXCHANGE', 'REPAIR');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "delivery_proof_media_file_id" UUID,
ADD COLUMN     "receipt_confirmed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "requester_user_id" UUID,
    "kind" "ReturnKind" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "resolution" "ReturnResolution",
    "response" TEXT,
    "refund_amount" DECIMAL(19,4),
    "refund_id" UUID,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_items" (
    "id" UUID NOT NULL,
    "return_request_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_refund_id_key" ON "return_requests"("refund_id");

-- CreateIndex
CREATE INDEX "return_requests_status_created_at_idx" ON "return_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "return_requests_order_id_idx" ON "return_requests"("order_id");

-- CreateIndex
CREATE INDEX "return_request_items_order_item_id_idx" ON "return_request_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_request_items_return_request_id_order_item_id_key" ON "return_request_items"("return_request_id", "order_item_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_proof_media_file_id_fkey" FOREIGN KEY ("delivery_proof_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_items" ADD CONSTRAINT "return_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Pedidos entregues antes da regra: a entrega registrada pela diretoria vale como comprovada.
UPDATE "orders" SET "delivery_confirmed_at" = "delivered_at" WHERE "status" IN ('DELIVERED', 'REFUNDED') AND "delivered_at" IS NOT NULL;
