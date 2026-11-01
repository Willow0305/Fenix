-- Versões dos termos de uso e da política de privacidade e aceite por versão (DT-089).

-- CreateEnum
CREATE TYPE "LegalDocumentKind" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY');

-- CreateTable
CREATE TABLE "legal_document_versions" (
    "id" UUID NOT NULL,
    "kind" "LegalDocumentKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "context" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_document_versions_kind_published_at_idx" ON "legal_document_versions"("kind", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_versions_kind_version_key" ON "legal_document_versions"("kind", "version");

-- CreateIndex
CREATE INDEX "legal_acceptances_document_version_id_idx" ON "legal_acceptances"("document_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptances_user_id_document_version_id_key" ON "legal_acceptances"("user_id", "document_version_id");

-- AddForeignKey
ALTER TABLE "legal_document_versions" ADD CONSTRAINT "legal_document_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "legal_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Textos já publicados nas configurações viram a versão 1 de cada documento.
INSERT INTO "legal_document_versions" ("id", "kind", "version", "content", "content_hash", "published_at")
SELECT gen_random_uuid(), 'TERMS_OF_USE', 1, "terms_of_use",
       encode(sha256(convert_to("terms_of_use", 'UTF8')), 'hex'), "updated_at"
FROM "team_settings"
WHERE "singleton_key" = 'default' AND "terms_of_use" IS NOT NULL AND btrim("terms_of_use") <> '';

INSERT INTO "legal_document_versions" ("id", "kind", "version", "content", "content_hash", "published_at")
SELECT gen_random_uuid(), 'PRIVACY_POLICY', 1, "privacy_policy",
       encode(sha256(convert_to("privacy_policy", 'UTF8')), 'hex'), "updated_at"
FROM "team_settings"
WHERE "singleton_key" = 'default' AND "privacy_policy" IS NOT NULL AND btrim("privacy_policy") <> '';
