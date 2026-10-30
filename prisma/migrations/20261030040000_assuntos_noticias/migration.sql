-- CreateTable
CREATE TABLE "news_tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "news_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_tag_links" (
    "id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_tags_slug_key" ON "news_tags"("slug");

-- CreateIndex
CREATE INDEX "news_tags_is_active_deleted_at_idx" ON "news_tags"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "news_tag_links_tag_id_idx" ON "news_tag_links"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_tag_links_news_id_tag_id_key" ON "news_tag_links"("news_id", "tag_id");

-- AddForeignKey
ALTER TABLE "news_tag_links" ADD CONSTRAINT "news_tag_links_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_tag_links" ADD CONSTRAINT "news_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "news_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

