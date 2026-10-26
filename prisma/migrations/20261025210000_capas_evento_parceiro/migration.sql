-- PEN-058, DT-041: capa 16:9 de evento e de parceiro (só a referência ao arquivo).
-- Altera tabela
ALTER TABLE "events" ADD COLUMN     "cover_media_file_id" UUID;

-- Altera tabela
ALTER TABLE "partners" ADD COLUMN     "cover_media_file_id" UUID;

-- Cria índice
CREATE INDEX "events_cover_media_file_id_idx" ON "events"("cover_media_file_id");

-- Cria índice
CREATE INDEX "partners_logo_media_file_id_idx" ON "partners"("logo_media_file_id");

-- Cria índice
CREATE INDEX "partners_cover_media_file_id_idx" ON "partners"("cover_media_file_id");

-- Adiciona chave estrangeira
ALTER TABLE "partners" ADD CONSTRAINT "partners_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "events" ADD CONSTRAINT "events_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

