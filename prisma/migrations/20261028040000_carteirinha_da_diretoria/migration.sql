-- Carteirinha gratuita da diretoria e benefícios por público (DT-077).
ALTER TYPE "MemberCardType" ADD VALUE 'BOARD';

ALTER TABLE "partner_benefits"
ADD COLUMN     "for_affiliates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "for_athletes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "for_board" BOOLEAN NOT NULL DEFAULT true;

-- Benefícios atuais: a diretoria recebe os mesmos dos atletas (decisão do responsável).
UPDATE "partner_benefits" SET
  "for_athletes" = "audience" IN ('ATHLETES', 'BOTH'),
  "for_affiliates" = "audience" IN ('AFFILIATES', 'BOTH'),
  "for_board" = "audience" IN ('ATHLETES', 'BOTH');

ALTER TABLE "partner_benefits" DROP COLUMN "audience";
DROP TYPE "BenefitAudience";

-- Todo benefício vale para ao menos um público.
ALTER TABLE "partner_benefits" ADD CONSTRAINT "partner_benefits_audience_check"
  CHECK ("for_board" OR "for_athletes" OR "for_affiliates");
