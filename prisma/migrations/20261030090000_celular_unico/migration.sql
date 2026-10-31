-- Celular único entre as contas (DT-084), como o e-mail.

-- 1. Guarda só os dígitos: "(68) 99999-0000" e "68999990000" são o mesmo número.
UPDATE "users"
SET "phone" = NULLIF(regexp_replace("phone", '\D', '', 'g'), '')
WHERE "phone" IS NOT NULL AND "phone" ~ '\D';

-- 2. Número repetido fica com a conta mais antiga; nas outras é apagado, com registro na
--    auditoria (sem o número, só o fato e a conta que ficou com ele).
WITH ranked AS (
  SELECT
    "id",
    first_value("id") OVER (PARTITION BY "phone" ORDER BY "created_at", "id") AS "kept_by",
    row_number() OVER (PARTITION BY "phone" ORDER BY "created_at", "id") AS "position"
  FROM "users"
  WHERE "phone" IS NOT NULL
)
INSERT INTO "audit_logs" ("id", "action", "entity_type", "entity_id", "reason", "before_data", "after_data")
SELECT
  gen_random_uuid(),
  'user.phone_cleared_duplicate',
  'User',
  ranked."id",
  'Celular passou a ser único (DT-084): o número ficou com a conta mais antiga.',
  jsonb_build_object('hadPhone', true, 'keptByUserId', ranked."kept_by"),
  jsonb_build_object('hadPhone', false)
FROM ranked
WHERE ranked."position" > 1;

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "phone" ORDER BY "created_at", "id") AS "position"
  FROM "users"
  WHERE "phone" IS NOT NULL
)
UPDATE "users" SET "phone" = NULL
FROM ranked
WHERE "users"."id" = ranked."id" AND ranked."position" > 1;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
