-- Limites de sessão por inatividade e duração total (DT-036).
ALTER TABLE "user_sessions"
    ADD COLUMN "authenticated_at" TIMESTAMPTZ(6),
    ADD COLUMN "last_activity_at" TIMESTAMPTZ(6);

-- O instante do login é o da primeira sessão da cadeia de rotações; usar a própria linha
-- reiniciaria o relógio de sessões abertas há dias. A última atividade conhecida é a
-- criação da linha, pois renovações anteriores não registravam uso real.
WITH RECURSIVE chain AS (
    SELECT "id", "created_at" AS "root_created_at"
    FROM "user_sessions"
    WHERE "rotated_from_session_id" IS NULL
    UNION ALL
    SELECT s."id", c."root_created_at"
    FROM "user_sessions" s
    JOIN chain c ON s."rotated_from_session_id" = c."id"
)
UPDATE "user_sessions" u
SET "authenticated_at" = COALESCE(chain."root_created_at", u."created_at"),
    "last_activity_at" = u."created_at"
FROM "user_sessions" base
LEFT JOIN chain ON chain."id" = base."id"
WHERE base."id" = u."id";

ALTER TABLE "user_sessions"
    ALTER COLUMN "authenticated_at" SET NOT NULL,
    ALTER COLUMN "last_activity_at" SET NOT NULL;
