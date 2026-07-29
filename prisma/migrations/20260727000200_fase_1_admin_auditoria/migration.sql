-- AlterTable
ALTER TABLE "users"
ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "blocked_until" TIMESTAMPTZ(6);

ALTER TABLE "user_sessions"
ADD COLUMN "csrf_token_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "reason" VARCHAR(250),
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "request_id" UUID,
    "ip_address_hash" TEXT,
    "user_agent_hash" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_action_not_blank" CHECK (length(btrim("action")) > 0),
    CONSTRAINT "audit_logs_entity_type_not_blank" CHECK (length(btrim("entity_type")) > 0),
    CONSTRAINT "audit_logs_reason_not_blank" CHECK ("reason" IS NULL OR length(btrim("reason")) > 0),
    CONSTRAINT "audit_logs_ip_address_hash_not_blank" CHECK ("ip_address_hash" IS NULL OR length(btrim("ip_address_hash")) > 0),
    CONSTRAINT "audit_logs_user_agent_hash_not_blank" CHECK ("user_agent_hash" IS NULL OR length(btrim("user_agent_hash")) > 0)
);

-- AddCheckConstraints
ALTER TABLE "users"
ADD CONSTRAINT "users_failed_login_attempts_valid" CHECK ("failed_login_attempts" >= 0),
ADD CONSTRAINT "users_blocked_until_valid" CHECK ("blocked_until" IS NULL OR "blocked_until" >= "created_at");

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_csrf_token_hash_not_blank" CHECK (length(btrim("csrf_token_hash")) > 0);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx"
ON "audit_logs"("entity_type", "entity_id", "occurred_at");

CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx"
ON "audit_logs"("actor_user_id", "occurred_at");

CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

CREATE INDEX "audit_logs_action_occurred_at_idx"
ON "audit_logs"("action", "occurred_at");

-- AddForeignKey
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only protection
CREATE FUNCTION "prevent_audit_log_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_log_mutation"();
