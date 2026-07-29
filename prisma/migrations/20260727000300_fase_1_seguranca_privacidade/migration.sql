-- ExtendEnum
ALTER TYPE "UserTokenType" ADD VALUE 'EMAIL_VERIFICATION';
ALTER TYPE "UserTokenType" ADD VALUE 'MFA_LOGIN_CHALLENGE';

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM (
    'ACCESS',
    'CORRECTION',
    'ANONYMIZATION',
    'DELETION',
    'PORTABILITY',
    'CONSENT_REVOCATION',
    'INFORMATION'
);

CREATE TYPE "DataSubjectRequestStatus" AS ENUM (
    'RECEIVED',
    'IDENTITY_VERIFICATION_PENDING',
    'IN_REVIEW',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
);

CREATE TYPE "RetentionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TYPE "PrivateAttachmentStatus" AS ENUM (
    'PENDING',
    'AVAILABLE',
    'QUARANTINED',
    'REMOVED'
);

-- Harden existing identity records without breaking Phase 1 data
ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMPTZ(6),
ADD COLUMN "login_failure_window_started_at" TIMESTAMPTZ(6);

UPDATE "users"
SET "email_verified_at" = "created_at"
WHERE "status" = 'ACTIVE';

ALTER TABLE "user_sessions"
ADD COLUMN "absolute_expires_at" TIMESTAMPTZ(6),
ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(6);

UPDATE "user_sessions"
SET "absolute_expires_at" = "expires_at";

ALTER TABLE "user_sessions"
ALTER COLUMN "absolute_expires_at" SET NOT NULL;

UPDATE "user_sessions" AS session
SET
    "revoked_at" = COALESCE(session."revoked_at", CURRENT_TIMESTAMP),
    "revocation_reason" = COALESCE(session."revocation_reason", 'MFA_POLICY_ACTIVATED')
WHERE session."revoked_at" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "user_roles" AS user_role
      JOIN "roles" AS role ON role."id" = user_role."role_id"
      WHERE user_role."user_id" = session."user_id"
        AND role."code" IN ('ADMIN', 'BOARD', 'FINANCE')
        AND role."deleted_at" IS NULL
        AND (user_role."expires_at" IS NULL OR user_role."expires_at" > CURRENT_TIMESTAMP)
  );

-- CreateTable
CREATE TABLE "mfa_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" VARCHAR(64) NOT NULL,
    "secret_auth_tag" VARCHAR(64) NOT NULL,
    "key_version" VARCHAR(50) NOT NULL,
    "last_totp_step" INTEGER,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mfa_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_credentials_secret_ciphertext_not_blank" CHECK (length(btrim("secret_ciphertext")) > 0),
    CONSTRAINT "mfa_credentials_secret_iv_not_blank" CHECK (length(btrim("secret_iv")) > 0),
    CONSTRAINT "mfa_credentials_secret_auth_tag_not_blank" CHECK (length(btrim("secret_auth_tag")) > 0),
    CONSTRAINT "mfa_credentials_key_version_not_blank" CHECK (length(btrim("key_version")) > 0),
    CONSTRAINT "mfa_credentials_last_totp_step_valid" CHECK ("last_totp_step" IS NULL OR "last_totp_step" >= 0),
    CONSTRAINT "mfa_credentials_confirmation_valid" CHECK ("confirmed_at" IS NULL OR "confirmed_at" >= "created_at")
);

CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mfa_recovery_codes_hash_not_blank" CHECK (length(btrim("code_hash")) > 0),
    CONSTRAINT "mfa_recovery_codes_used_at_valid" CHECK ("used_at" IS NULL OR "used_at" >= "created_at")
);

CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "subject_user_id" UUID,
    "requester_email" VARCHAR(180) NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "protocol" VARCHAR(40) NOT NULL,
    "channel" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "decision_reason" TEXT,
    "handled_by_id" UUID,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "data_subject_requests_email_normalized" CHECK (
        "requester_email" = lower(btrim("requester_email"))
        AND "requester_email" LIKE '%_@_%._%'
    ),
    CONSTRAINT "data_subject_requests_protocol_not_blank" CHECK (length(btrim("protocol")) > 0),
    CONSTRAINT "data_subject_requests_channel_not_blank" CHECK (length(btrim("channel")) > 0),
    CONSTRAINT "data_subject_requests_due_at_valid" CHECK ("due_at" IS NULL OR "due_at" >= "received_at"),
    CONSTRAINT "data_subject_requests_completed_at_valid" CHECK (
        ("status" IN ('COMPLETED', 'REJECTED', 'CANCELLED') AND "completed_at" IS NOT NULL)
        OR ("status" NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED') AND "completed_at" IS NULL)
    )
);

CREATE TABLE "retention_runs" (
    "id" UUID NOT NULL,
    "status" "RetentionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "policy_version" VARCHAR(50) NOT NULL,
    "summary" JSONB,
    "error_code" VARCHAR(100),
    "initiated_by_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "retention_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retention_runs_policy_version_not_blank" CHECK (length(btrim("policy_version")) > 0),
    CONSTRAINT "retention_runs_completion_valid" CHECK (
        ("status" = 'RUNNING' AND "completed_at" IS NULL)
        OR ("status" <> 'RUNNING' AND "completed_at" IS NOT NULL)
    )
);

CREATE TABLE "private_attachments" (
    "id" UUID NOT NULL,
    "purpose" VARCHAR(100) NOT NULL,
    "status" "PrivateAttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "object_key_ciphertext" TEXT NOT NULL,
    "object_key_iv" VARCHAR(64) NOT NULL,
    "object_key_auth_tag" VARCHAR(64) NOT NULL,
    "key_version" VARCHAR(50) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "retention_until" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "private_attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "private_attachments_purpose_not_blank" CHECK (length(btrim("purpose")) > 0),
    CONSTRAINT "private_attachments_object_key_ciphertext_not_blank" CHECK (length(btrim("object_key_ciphertext")) > 0),
    CONSTRAINT "private_attachments_crypto_metadata_not_blank" CHECK (
        length(btrim("object_key_iv")) > 0
        AND length(btrim("object_key_auth_tag")) > 0
        AND length(btrim("key_version")) > 0
    ),
    CONSTRAINT "private_attachments_original_name_not_blank" CHECK (length(btrim("original_name")) > 0),
    CONSTRAINT "private_attachments_mime_type_not_blank" CHECK (length(btrim("mime_type")) > 0),
    CONSTRAINT "private_attachments_size_valid" CHECK ("size_bytes" > 0),
    CONSTRAINT "private_attachments_checksum_valid" CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "private_attachments_removal_valid" CHECK (
        ("status" = 'REMOVED' AND "removed_at" IS NOT NULL)
        OR ("status" <> 'REMOVED' AND "removed_at" IS NULL)
    )
);

-- AddCheckConstraints
ALTER TABLE "users"
ADD CONSTRAINT "users_login_failure_window_valid" CHECK (
    "login_failure_window_started_at" IS NULL
    OR "login_failure_window_started_at" >= "created_at"
);

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_absolute_expiration_valid" CHECK (
    "absolute_expires_at" >= "created_at"
    AND "expires_at" <= "absolute_expires_at"
),
ADD CONSTRAINT "user_sessions_mfa_verified_at_valid" CHECK (
    "mfa_verified_at" IS NULL
    OR ("mfa_verified_at" >= "created_at" AND "mfa_verified_at" <= "absolute_expires_at")
);

-- CreateIndex
CREATE INDEX "users_email_verified_at_status_idx"
ON "users"("email_verified_at", "status");

CREATE UNIQUE INDEX "mfa_credentials_user_id_key"
ON "mfa_credentials"("user_id");

CREATE INDEX "mfa_credentials_confirmed_at_idx"
ON "mfa_credentials"("confirmed_at");

CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key"
ON "mfa_recovery_codes"("code_hash");

CREATE INDEX "mfa_recovery_codes_credential_id_used_at_idx"
ON "mfa_recovery_codes"("credential_id", "used_at");

CREATE UNIQUE INDEX "data_subject_requests_protocol_key"
ON "data_subject_requests"("protocol");

CREATE INDEX "data_subject_requests_status_received_at_idx"
ON "data_subject_requests"("status", "received_at");

CREATE INDEX "data_subject_requests_subject_user_id_received_at_idx"
ON "data_subject_requests"("subject_user_id", "received_at");

CREATE INDEX "retention_runs_status_started_at_idx"
ON "retention_runs"("status", "started_at");

CREATE INDEX "private_attachments_purpose_status_retention_until_idx"
ON "private_attachments"("purpose", "status", "retention_until");

-- AddForeignKey
ALTER TABLE "mfa_credentials"
ADD CONSTRAINT "mfa_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes"
ADD CONSTRAINT "mfa_recovery_codes_credential_id_fkey"
FOREIGN KEY ("credential_id") REFERENCES "mfa_credentials"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_subject_requests"
ADD CONSTRAINT "data_subject_requests_subject_user_id_fkey"
FOREIGN KEY ("subject_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "data_subject_requests"
ADD CONSTRAINT "data_subject_requests_handled_by_id_fkey"
FOREIGN KEY ("handled_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retention_runs"
ADD CONSTRAINT "retention_runs_initiated_by_id_fkey"
FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "private_attachments"
ADD CONSTRAINT "private_attachments_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
