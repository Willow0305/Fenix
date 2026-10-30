-- CreateTable
CREATE TABLE "news_images" (
    "id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "alt_text" VARCHAR(180),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "news_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_images_news_id_sort_order_deleted_at_idx" ON "news_images"("news_id", "sort_order", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "news_images_news_id_media_file_id_key" ON "news_images"("news_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "news_images" ADD CONSTRAINT "news_images_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_images" ADD CONSTRAINT "news_images_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

