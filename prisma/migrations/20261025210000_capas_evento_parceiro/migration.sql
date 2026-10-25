-- PEN-058, DT-041: capa 16:9 de evento e de parceiro (só a referência ao arquivo).
-- AlterTable
ALTER TABLE "events" ADD COLUMN     "cover_media_file_id" UUID;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "cover_media_file_id" UUID;

-- CreateIndex
CREATE INDEX "events_cover_media_file_id_idx" ON "events"("cover_media_file_id");

-- CreateIndex
CREATE INDEX "partners_logo_media_file_id_idx" ON "partners"("logo_media_file_id");

-- CreateIndex
CREATE INDEX "partners_cover_media_file_id_idx" ON "partners"("cover_media_file_id");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

