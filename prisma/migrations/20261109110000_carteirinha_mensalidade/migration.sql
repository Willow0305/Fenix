-- AlterTable
ALTER TABLE "member_cards" ADD COLUMN     "fee_blocked_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "card_fee_tolerance_days" SMALLINT NOT NULL DEFAULT 10;


-- Tolerância entre 0 e 90 dias (DT-101).
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_card_fee_tolerance_days_check"
  CHECK ("card_fee_tolerance_days" BETWEEN 0 AND 90);
