-- PEN-062, DT-044: foto de perfil, perfil público e autorização do responsável para menores.
-- Altera tabela
ALTER TABLE "athletes" ADD COLUMN     "public_profile_consent_at" TIMESTAMPTZ(6);

-- Altera tabela
ALTER TABLE "users" ADD COLUMN     "avatar_media_file_id" UUID,
ADD COLUMN     "profile_public" BOOLEAN NOT NULL DEFAULT false;

-- Cria índice
CREATE INDEX "users_avatar_media_file_id_idx" ON "users"("avatar_media_file_id");

-- Adiciona chave estrangeira
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_file_id_fkey" FOREIGN KEY ("avatar_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
