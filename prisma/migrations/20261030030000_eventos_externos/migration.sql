-- AlterTable
ALTER TABLE "events" ADD COLUMN     "city" VARCHAR(120),
ADD COLUMN     "is_external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "official_url" VARCHAR(500),
ADD COLUMN     "organizer_name" VARCHAR(160),
ADD COLUMN     "state" CHAR(2),
ADD COLUMN     "ticket_currency" CHAR(3) NOT NULL DEFAULT 'BRL',
ADD COLUMN     "ticket_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "external_matches" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "home_team_name" VARCHAR(160) NOT NULL,
    "away_team_name" VARCHAR(160) NOT NULL,
    "competition_name" VARCHAR(160),
    "home_score" INTEGER,
    "away_score" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_matches_event_id_key" ON "external_matches"("event_id");

-- CreateIndex
CREATE INDEX "events_is_external_starts_at_idx" ON "events"("is_external", "starts_at");

-- CreateIndex
CREATE INDEX "events_state_starts_at_idx" ON "events"("state", "starts_at");

-- AddForeignKey
ALTER TABLE "external_matches" ADD CONSTRAINT "external_matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Entrada gratuita e preço não convivem; preço nunca negativo; UF em maiúsculas (D3, DT-081).
ALTER TABLE "events" ADD CONSTRAINT "events_ticket_check" CHECK (NOT ("is_free" AND "ticket_price" IS NOT NULL) AND ("ticket_price" IS NULL OR "ticket_price" >= 0));
ALTER TABLE "events" ADD CONSTRAINT "events_state_check" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$');
ALTER TABLE "events" ADD CONSTRAINT "events_external_organizer_check" CHECK (NOT "is_external" OR "organizer_name" IS NOT NULL);
ALTER TABLE "external_matches" ADD CONSTRAINT "external_matches_score_check" CHECK (("home_score" IS NULL OR "home_score" >= 0) AND ("away_score" IS NULL OR "away_score" >= 0));
