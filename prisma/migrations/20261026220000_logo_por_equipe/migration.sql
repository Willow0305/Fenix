-- Logo própria por equipe (DT-064).
ALTER TABLE "teams" ADD COLUMN "logo_media_file_id" UUID;

CREATE INDEX "teams_logo_media_file_id_idx" ON "teams"("logo_media_file_id");

ALTER TABLE "teams" ADD CONSTRAINT "teams_logo_media_file_id_fkey" FOREIGN KEY ("logo_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As logos "time masculino" e "time feminino" das Configurações passam para as equipes
-- desse tipo, para nada sumir do site; depois saem das Configurações.
UPDATE "teams" AS t
SET "logo_media_file_id" = a."media_file_id"
FROM "team_brand_assets" AS a
WHERE a."context"::text = t."type"::text
  AND a."context" IN ('MALE', 'FEMALE')
  AND t."logo_media_file_id" IS NULL
  AND t."deleted_at" IS NULL;

DELETE FROM "team_brand_assets" WHERE "context" IN ('MALE', 'FEMALE');
