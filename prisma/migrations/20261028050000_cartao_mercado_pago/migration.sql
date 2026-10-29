-- Cartão de crédito e débito pelo Mercado Pago (DT-079).

-- CreateEnum
CREATE TYPE "CardChargeStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'REVIEW', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrderPaymentChoice" ADD VALUE 'ONLINE_CARD';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "interest_free_installments" SMALLINT;

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "provider_refund_error" TEXT,
ADD COLUMN     "provider_refund_id" VARCHAR(100),
ADD COLUMN     "provider_refund_status" VARCHAR(20);

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "card_differential_pricing" JSONB;

-- CreateTable
CREATE TABLE "card_charges" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_payment_id" VARCHAR(100) NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "installments" SMALLINT NOT NULL,
    "payment_type" VARCHAR(20) NOT NULL,
    "brand" VARCHAR(30),
    "last_four" CHAR(4),
    "interest_free" BOOLEAN NOT NULL DEFAULT false,
    "status" "CardChargeStatus" NOT NULL DEFAULT 'PENDING',
    "status_detail" VARCHAR(80),
    "payment_id" UUID,
    "review_reason" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "card_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_charges_payment_id_key" ON "card_charges"("payment_id");

-- CreateIndex
CREATE INDEX "card_charges_status_created_at_idx" ON "card_charges"("status", "created_at");

-- CreateIndex
CREATE INDEX "card_charges_order_id_idx" ON "card_charges"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_charges_provider_provider_payment_id_key" ON "card_charges"("provider", "provider_payment_id");

-- AddForeignKey
ALTER TABLE "card_charges" ADD CONSTRAINT "card_charges_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_charges" ADD CONSTRAINT "card_charges_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "products" ADD CONSTRAINT "products_interest_free_installments_check"
  CHECK ("interest_free_installments" IS NULL OR "interest_free_installments" BETWEEN 2 AND 12);
ALTER TABLE "card_charges" ADD CONSTRAINT "card_charges_installments_check"
  CHECK ("installments" BETWEEN 1 AND 12);
ALTER TABLE "card_charges" ADD CONSTRAINT "card_charges_amount_check" CHECK ("amount" > 0);
