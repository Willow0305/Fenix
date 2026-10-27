-- Produtos personalizados (DT-069).
-- CreateEnum
CREATE TYPE "PersonalizationKind" AS ENUM ('TEXT', 'NUMBER');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "model" VARCHAR(80);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "size_guide" TEXT;

-- CreateTable
CREATE TABLE "product_personalization_fields" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "kind" "PersonalizationKind" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "max_length" INTEGER,
    "min_value" INTEGER,
    "max_value" INTEGER,
    "uppercase" BOOLEAN NOT NULL DEFAULT true,
    "extra_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_personalization_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_personalization_fields_product_id_is_active_deleted_idx" ON "product_personalization_fields"("product_id", "is_active", "deleted_at");

-- AddForeignKey
ALTER TABLE "product_personalization_fields" ADD CONSTRAINT "product_personalization_fields_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

