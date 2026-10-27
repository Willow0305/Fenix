-- Afiliação vendida pela loja (DT-068) e detalhes por linha do carrinho/pedido (DT-069).
-- AlterEnum
ALTER TYPE "ProductFulfillmentType" ADD VALUE 'MEMBERSHIP';

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "details" JSONB,
ADD COLUMN     "details_key" VARCHAR(64) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "membership_announced_at" TIMESTAMPTZ(6),
ADD COLUMN     "membership_months" INTEGER;

