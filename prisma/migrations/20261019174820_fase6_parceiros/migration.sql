-- Altera tabela
ALTER TABLE "appointments" ADD COLUMN     "requester_notes" VARCHAR(500);

-- Altera tabela
ALTER TABLE "partner_professionals" ADD COLUMN     "public_contact" BOOLEAN NOT NULL DEFAULT false;

-- Altera tabela
ALTER TABLE "partner_settlements" ADD COLUMN     "adjustment_reason" TEXT;

-- Altera tabela
ALTER TABLE "partners" ADD COLUMN     "website_url" VARCHAR(300);

