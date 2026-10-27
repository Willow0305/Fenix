-- Finalidades de aviso de conteúdo (DT-067).
ALTER TYPE "NotificationCategory" ADD VALUE 'NEWS';
ALTER TYPE "NotificationCategory" ADD VALUE 'EVENTS';
ALTER TYPE "NotificationCategory" ADD VALUE 'FORUM_TOPICS';

ALTER TABLE "news" ADD COLUMN "announced_at" TIMESTAMPTZ(6);
ALTER TABLE "events" ADD COLUMN "announced_at" TIMESTAMPTZ(6);

-- O que já está no ar não é anunciado de novo depois da atualização.
UPDATE "news" SET "announced_at" = CURRENT_TIMESTAMP
WHERE "published_at" IS NOT NULL AND "published_at" <= CURRENT_TIMESTAMP;
UPDATE "events" SET "announced_at" = CURRENT_TIMESTAMP
WHERE "published_at" IS NOT NULL AND "published_at" <= CURRENT_TIMESTAMP;
