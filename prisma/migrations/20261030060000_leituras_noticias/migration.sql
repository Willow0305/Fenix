-- CreateTable
CREATE TABLE "news_daily_views" (
    "id" UUID NOT NULL,
    "news_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "news_daily_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_daily_views_day_idx" ON "news_daily_views"("day");

-- CreateIndex
CREATE UNIQUE INDEX "news_daily_views_news_id_day_key" ON "news_daily_views"("news_id", "day");

-- AddForeignKey
ALTER TABLE "news_daily_views" ADD CONSTRAINT "news_daily_views_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Contagem nunca negativa.
ALTER TABLE "news_daily_views" ADD CONSTRAINT "news_daily_views_views_check" CHECK ("views" >= 0);
