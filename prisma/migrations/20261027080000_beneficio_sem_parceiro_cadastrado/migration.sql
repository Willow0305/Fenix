-- Benefício de parceiro sem cadastro no site (DT-074): nome livre no lugar do parceiro.
ALTER TABLE "partner_benefits" ADD COLUMN     "partner_details" VARCHAR(500),
ADD COLUMN     "partner_name" VARCHAR(120),
ALTER COLUMN "partner_id" DROP NOT NULL;

-- Exatamente um: parceiro cadastrado ou nome livre.
ALTER TABLE "partner_benefits" ADD CONSTRAINT "partner_benefits_partner_xor"
  CHECK ((partner_id IS NOT NULL) <> (partner_name IS NOT NULL));
