-- A ficha do atleta aceita mais de uma posição (DT-085). A posição que já existia vira o
-- primeiro item da lista. A posição do vínculo com o time (team_athletes) continua única.

-- AlterTable
ALTER TABLE "athletes"
ADD COLUMN "positions" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[];

UPDATE "athletes"
SET "positions" = ARRAY["position"]::VARCHAR(80)[]
WHERE "position" IS NOT NULL AND btrim("position") <> '';

ALTER TABLE "athletes" DROP COLUMN "position";
