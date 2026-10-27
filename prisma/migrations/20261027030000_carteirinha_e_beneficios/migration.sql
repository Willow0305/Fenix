-- Carteirinha digital e benefícios de parceiros (DT-068).
-- CreateEnum
CREATE TYPE "MemberCardType" AS ENUM ('ATHLETE', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "MemberCardStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BenefitAudience" AS ENUM ('ATHLETES', 'AFFILIATES', 'BOTH');

-- CreateEnum
CREATE TYPE "CardTemplate" AS ENUM ('CLASSIC', 'LIGHT', 'STRIPE');

-- AlterEnum
ALTER TYPE "TeamBrandContext" ADD VALUE 'CARD_BACKGROUND';

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "card_template" "CardTemplate" NOT NULL DEFAULT 'CLASSIC',
ADD COLUMN     "card_use_team_logo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "member_cards" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "MemberCardType" NOT NULL,
    "status" "MemberCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "athlete_id" UUID,
    "holder_user_id" UUID,
    "holder_name" VARCHAR(160) NOT NULL,
    "holder_email" VARCHAR(180),
    "purchased_by_user_id" UUID,
    "order_item_id" UUID,
    "starts_on" DATE,
    "ends_on" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "member_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_card_checks" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "reason" VARCHAR(40),
    "by_staff" BOOLEAN NOT NULL DEFAULT false,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_card_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_benefits" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "conditions" TEXT,
    "audience" "BenefitAudience" NOT NULL DEFAULT 'BOTH',
    "starts_on" DATE,
    "ends_on" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partner_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_cards_code_key" ON "member_cards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "member_cards_athlete_id_key" ON "member_cards"("athlete_id");

-- CreateIndex
CREATE INDEX "member_cards_type_status_deleted_at_idx" ON "member_cards"("type", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "member_cards_holder_user_id_idx" ON "member_cards"("holder_user_id");

-- CreateIndex
CREATE INDEX "member_cards_purchased_by_user_id_idx" ON "member_cards"("purchased_by_user_id");

-- CreateIndex
CREATE INDEX "member_cards_holder_email_idx" ON "member_cards"("holder_email");

-- CreateIndex
CREATE INDEX "member_cards_order_item_id_idx" ON "member_cards"("order_item_id");

-- CreateIndex
CREATE INDEX "member_card_checks_card_id_checked_at_idx" ON "member_card_checks"("card_id", "checked_at");

-- CreateIndex
CREATE INDEX "member_card_checks_checked_at_idx" ON "member_card_checks"("checked_at");

-- CreateIndex
CREATE INDEX "partner_benefits_partner_id_is_active_deleted_at_idx" ON "partner_benefits"("partner_id", "is_active", "deleted_at");

-- AddForeignKey
ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_holder_user_id_fkey" FOREIGN KEY ("holder_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_purchased_by_user_id_fkey" FOREIGN KEY ("purchased_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_cards" ADD CONSTRAINT "member_cards_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_card_checks" ADD CONSTRAINT "member_card_checks_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "member_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_benefits" ADD CONSTRAINT "partner_benefits_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

