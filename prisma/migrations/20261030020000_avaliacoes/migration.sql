-- Avaliações de produto (DT-081): estrelas de 1 a 5, comentário e moderação da diretoria.
-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "status" "ProductReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderated_by_id" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "moderation_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_reviews_status_created_at_idx" ON "product_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_moderated_by_id_idx" ON "product_reviews"("moderated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_product_id_user_id_key" ON "product_reviews"("product_id", "user_id");

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Nota sempre de 1 a 5, também no banco.
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
