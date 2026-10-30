-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "photo_media_file_id" UUID;

-- CreateIndex
CREATE INDEX "teams_photo_media_file_id_idx" ON "teams"("photo_media_file_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_photo_media_file_id_fkey" FOREIGN KEY ("photo_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

