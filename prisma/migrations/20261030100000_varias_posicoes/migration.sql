-- Posição desejada passa a aceitar mais de uma (levantador, ponteiro, oposto…).
-- O valor que já existia vira o primeiro item da lista.

-- AlterTable
ALTER TABLE "interested_people"
ADD COLUMN "desired_positions" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[];

UPDATE "interested_people"
SET "desired_positions" = ARRAY["desired_position"]::VARCHAR(80)[]
WHERE "desired_position" IS NOT NULL AND btrim("desired_position") <> '';

ALTER TABLE "interested_people" DROP COLUMN "desired_position";

-- AlterTable
ALTER TABLE "tryout_registrations"
ADD COLUMN "desired_positions" VARCHAR(80)[] DEFAULT ARRAY[]::VARCHAR(80)[];

UPDATE "tryout_registrations"
SET "desired_positions" = ARRAY["desired_position"]::VARCHAR(80)[]
WHERE "desired_position" IS NOT NULL AND btrim("desired_position") <> '';

ALTER TABLE "tryout_registrations" DROP COLUMN "desired_position";
