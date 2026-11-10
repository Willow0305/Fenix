-- CreateEnum
CREATE TYPE "AccountabilityReportStatus" AS ENUM ('ISSUED', 'REPLACED');

-- CreateTable
CREATE TABLE "accountability_reports" (
    "id" UUID NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "revision" SMALLINT NOT NULL DEFAULT 1,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "AccountabilityReportStatus" NOT NULL DEFAULT 'ISSUED',
    "snapshot" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "verification_code" CHAR(12) NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "issued_by_id" UUID,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaces_id" UUID,
    "replacement_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accountability_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accountability_reports_content_hash_key" ON "accountability_reports"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "accountability_reports_idempotency_key_key" ON "accountability_reports"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "accountability_reports_replaces_id_key" ON "accountability_reports"("replaces_id");

-- CreateIndex
CREATE INDEX "accountability_reports_period_start_period_end_idx" ON "accountability_reports"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "accountability_reports_verification_code_idx" ON "accountability_reports"("verification_code");

-- CreateIndex
CREATE INDEX "accountability_reports_status_issued_at_idx" ON "accountability_reports"("status", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "accountability_reports_number_revision_key" ON "accountability_reports"("number", "revision");

-- AddForeignKey
ALTER TABLE "accountability_reports" ADD CONSTRAINT "accountability_reports_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_reports" ADD CONSTRAINT "accountability_reports_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "accountability_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Documento emitido não muda (DT-103): conteúdo, hash, número e período ficam congelados.
-- Só a situação (ISSUED → REPLACED) pode mudar, quando uma versão corrigida o substitui.
CREATE FUNCTION accountability_reports_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.verification_code IS DISTINCT FROM OLD.verification_code
    OR NEW.number IS DISTINCT FROM OLD.number
    OR NEW.revision IS DISTINCT FROM OLD.revision
    OR NEW.period_start IS DISTINCT FROM OLD.period_start
    OR NEW.period_end IS DISTINCT FROM OLD.period_end
    OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.replaces_id IS DISTINCT FROM OLD.replaces_id THEN
    RAISE EXCEPTION 'Prestação de contas emitida não pode ser alterada';
  END IF;

  IF OLD.status = 'REPLACED' AND NEW.status <> 'REPLACED' THEN
    RAISE EXCEPTION 'Prestação de contas substituída não volta a valer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accountability_reports_immutable
  BEFORE UPDATE ON "accountability_reports"
  FOR EACH ROW EXECUTE FUNCTION accountability_reports_immutable();

CREATE FUNCTION accountability_reports_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Prestação de contas emitida não pode ser apagada';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accountability_reports_no_delete
  BEFORE DELETE ON "accountability_reports"
  FOR EACH ROW EXECUTE FUNCTION accountability_reports_no_delete();
