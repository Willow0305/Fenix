-- Advertências e suspensões do fórum e regras escritas pela diretoria (DT-108).
-- CreateEnum
CREATE TYPE "ForumSanctionKind" AS ENUM ('WARNING', 'SUSPENSION');

-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN     "forum_rules" TEXT;

-- CreateTable
CREATE TABLE "forum_sanctions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ForumSanctionKind" NOT NULL,
    "rule" VARCHAR(160) NOT NULL,
    "reason" TEXT NOT NULL,
    "topic_id" UUID,
    "post_id" UUID,
    "ends_at" TIMESTAMPTZ(6),
    "lifted_at" TIMESTAMPTZ(6),
    "lifted_by_id" UUID,
    "lift_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_sanctions_user_id_kind_lifted_at_idx" ON "forum_sanctions"("user_id", "kind", "lifted_at");

-- CreateIndex
CREATE INDEX "forum_sanctions_created_at_idx" ON "forum_sanctions"("created_at");

-- AddForeignKey
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prazo só existe na suspensão; liberar exige quando, quem e por quê.
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_ends_only_suspension"
  CHECK ("kind" = 'SUSPENSION' OR "ends_at" IS NULL);
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_lift_complete"
  CHECK (("lifted_at" IS NULL AND "lift_reason" IS NULL) OR ("lifted_at" IS NOT NULL AND "lift_reason" IS NOT NULL));
ALTER TABLE "forum_sanctions" ADD CONSTRAINT "forum_sanctions_reason_length"
  CHECK (char_length("reason") BETWEEN 10 AND 1000 AND char_length("rule") >= 2);

-- Histórico da moderação: advertência e suspensão nunca são apagadas.
CREATE FUNCTION forum_sanctions_no_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Advertências e suspensões do fórum não são apagadas (DT-108).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forum_sanctions_no_delete
  BEFORE DELETE ON "forum_sanctions"
  FOR EACH ROW EXECUTE FUNCTION forum_sanctions_no_delete();
