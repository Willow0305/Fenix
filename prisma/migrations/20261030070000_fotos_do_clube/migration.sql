-- CreateTable
CREATE TABLE "club_photos" (
    "id" UUID NOT NULL,
    "team_settings_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "alt_text" VARCHAR(180),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "club_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "club_photos_team_settings_id_sort_order_deleted_at_idx" ON "club_photos"("team_settings_id", "sort_order", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "club_photos_team_settings_id_media_file_id_key" ON "club_photos"("team_settings_id", "media_file_id");

-- AddForeignKey
ALTER TABLE "club_photos" ADD CONSTRAINT "club_photos_team_settings_id_fkey" FOREIGN KEY ("team_settings_id") REFERENCES "team_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_photos" ADD CONSTRAINT "club_photos_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

