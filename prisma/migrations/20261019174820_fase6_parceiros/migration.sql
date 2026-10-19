-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "requester_notes" VARCHAR(500);

-- AlterTable
ALTER TABLE "partner_professionals" ADD COLUMN     "public_contact" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "partner_settlements" ADD COLUMN     "adjustment_reason" TEXT;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "website_url" VARCHAR(300);

