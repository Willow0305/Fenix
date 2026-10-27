-- PIX automático (DT-071).
-- CreateEnum
CREATE TYPE "PixChargeStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REVIEW');

-- CreateEnum
CREATE TYPE "PixPurpose" AS ENUM ('ORDER', 'MONTHLY_FEE');

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "pix_account_id" UUID;

-- CreateTable
CREATE TABLE "pix_charges" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_charge_id" VARCHAR(80) NOT NULL,
    "purpose" "PixPurpose" NOT NULL,
    "order_id" UUID,
    "monthly_fee_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PixChargeStatus" NOT NULL DEFAULT 'PENDING',
    "qr_code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "payment_id" UUID,
    "simulated_paid_at" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "review_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pix_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pix_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "event_key" VARCHAR(160) NOT NULL,
    "result" VARCHAR(40) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pix_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pix_charges_payment_id_key" ON "pix_charges"("payment_id");

-- CreateIndex
CREATE INDEX "pix_charges_status_expires_at_idx" ON "pix_charges"("status", "expires_at");

-- CreateIndex
CREATE INDEX "pix_charges_order_id_idx" ON "pix_charges"("order_id");

-- CreateIndex
CREATE INDEX "pix_charges_monthly_fee_id_idx" ON "pix_charges"("monthly_fee_id");

-- CreateIndex
CREATE UNIQUE INDEX "pix_charges_provider_provider_charge_id_key" ON "pix_charges"("provider", "provider_charge_id");

-- CreateIndex
CREATE INDEX "pix_webhook_events_received_at_idx" ON "pix_webhook_events"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "pix_webhook_events_provider_event_key_key" ON "pix_webhook_events"("provider", "event_key");

-- AddForeignKey
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_pix_account_id_fkey" FOREIGN KEY ("pix_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_charges" ADD CONSTRAINT "pix_charges_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_charges" ADD CONSTRAINT "pix_charges_monthly_fee_id_fkey" FOREIGN KEY ("monthly_fee_id") REFERENCES "monthly_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_charges" ADD CONSTRAINT "pix_charges_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

