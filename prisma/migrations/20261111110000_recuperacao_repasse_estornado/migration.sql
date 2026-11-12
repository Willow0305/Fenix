-- Vendas de parceiro estornadas depois do repasse pago, descontadas no repasse seguinte (PEN-052, DT-111).
-- CreateTable
CREATE TABLE "partner_settlement_recoveries" (
    "id" UUID NOT NULL,
    "partner_settlement_id" UUID NOT NULL,
    "settlement_item_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_settlement_recoveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_settlement_recoveries_partner_settlement_id_idx" ON "partner_settlement_recoveries"("partner_settlement_id");

-- CreateIndex
CREATE INDEX "partner_settlement_recoveries_settlement_item_id_idx" ON "partner_settlement_recoveries"("settlement_item_id");

-- AddForeignKey
ALTER TABLE "partner_settlement_recoveries" ADD CONSTRAINT "partner_settlement_recoveries_partner_settlement_id_fkey" FOREIGN KEY ("partner_settlement_id") REFERENCES "partner_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlement_recoveries" ADD CONSTRAINT "partner_settlement_recoveries_settlement_item_id_fkey" FOREIGN KEY ("settlement_item_id") REFERENCES "partner_settlement_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Registro financeiro: a recuperação não é alterada nem apagada (AGENTS.md).
CREATE FUNCTION partner_settlement_recoveries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Recuperação de repasse não pode ser alterada nem apagada';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partner_settlement_recoveries_immutable
  BEFORE UPDATE OR DELETE ON "partner_settlement_recoveries"
  FOR EACH ROW EXECUTE FUNCTION partner_settlement_recoveries_immutable();
