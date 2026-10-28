-- Entrega em casa (DT-075): regiões, bairros, endereços salvos e entrega no pedido.

-- CreateEnum
CREATE TYPE "OrderFulfillment" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_address" JSONB,
ADD COLUMN     "delivery_fee_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_zone_id" UUID,
ADD COLUMN     "fulfillment" "OrderFulfillment" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "out_for_delivery_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "is_delivery_fee" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "delivery_city" VARCHAR(120) NOT NULL DEFAULT 'Rio Branco',
ADD COLUMN     "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delivery_state" CHAR(2) NOT NULL DEFAULT 'AC',
ADD COLUMN     "free_delivery_minimum" DECIMAL(19,4);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "fee" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "lead_days" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_neighborhoods" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalized_name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" VARCHAR(60),
    "postal_code" CHAR(8) NOT NULL,
    "street" VARCHAR(200) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "complement" VARCHAR(120),
    "neighborhood_id" UUID,
    "neighborhood" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "reference" VARCHAR(200),
    "phone" VARCHAR(30),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_zones_is_active_deleted_at_idx" ON "delivery_zones"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "delivery_neighborhoods_zone_id_deleted_at_idx" ON "delivery_neighborhoods"("zone_id", "deleted_at");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_neighborhoods" ADD CONSTRAINT "delivery_neighborhoods_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "delivery_neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Cada bairro em uma só região (entre os não excluídos).
CREATE UNIQUE INDEX "delivery_neighborhoods_name_active_key"
  ON "delivery_neighborhoods"("normalized_name") WHERE "deleted_at" IS NULL;

-- Um endereço padrão por usuário.
CREATE UNIQUE INDEX "user_addresses_default_key"
  ON "user_addresses"("user_id") WHERE "is_default";

ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_fee_check" CHECK ("fee" >= 0);
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_lead_days_check"
  CHECK ("lead_days" BETWEEN 0 AND 60);
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_fee_check" CHECK ("delivery_fee_amount" >= 0);
-- Pedido com entrega sempre guarda o endereço.
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_check"
  CHECK ("fulfillment" = 'PICKUP' OR "delivery_address" IS NOT NULL);
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_free_delivery_check"
  CHECK ("free_delivery_minimum" IS NULL OR "free_delivery_minimum" >= 0);
