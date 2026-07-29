-- CreateEnum
CREATE TYPE "SportCategoryKind" AS ENUM (
    'AGE_GROUP',
    'GENDER',
    'LEVEL',
    'DIVISION',
    'OTHER'
);

CREATE TYPE "AthleteProfileStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

CREATE TYPE "GuardianAuthorizationStatus" AS ENUM (
    'PENDING',
    'VALID',
    'REVOKED',
    'EXPIRED'
);

CREATE TYPE "TryoutStatus" AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'OPEN',
    'CLOSED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE "TryoutRegistrationStatus" AS ENUM (
    'NEW',
    'UNDER_REVIEW',
    'WAITLISTED',
    'APPROVED',
    'REJECTED',
    'ATTENDED',
    'NO_SHOW',
    'CONVERTED',
    'CANCELLED'
);

CREATE TYPE "SportsImportKind" AS ENUM (
    'ATHLETE_PROFILE',
    'TRYOUT_REGISTRATION'
);

CREATE TYPE "ImportBatchStatus" AS ENUM (
    'CREATED',
    'VALIDATING',
    'VALIDATED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

CREATE TYPE "ImportRowStatus" AS ENUM (
    'PENDING',
    'VALID',
    'INVALID',
    'IMPORTED',
    'SKIPPED',
    'FAILED'
);

-- CreateTable
CREATE TABLE "sport_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "kind" "SportCategoryKind" NOT NULL,
    "description" TEXT,
    "minimum_age" SMALLINT,
    "maximum_age" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sport_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sport_categories_code_not_blank" CHECK (length(btrim("code")) > 0),
    CONSTRAINT "sport_categories_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "sport_categories_slug_not_blank" CHECK (length(btrim("slug")) > 0),
    CONSTRAINT "sport_categories_age_range_valid" CHECK (
        ("minimum_age" IS NULL OR ("minimum_age" >= 0 AND "minimum_age" <= 120))
        AND ("maximum_age" IS NULL OR ("maximum_age" >= 0 AND "maximum_age" <= 120))
        AND (
            "minimum_age" IS NULL
            OR "maximum_age" IS NULL
            OR "minimum_age" <= "maximum_age"
        )
    ),
    CONSTRAINT "sport_categories_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teams_code_not_blank" CHECK (length(btrim("code")) > 0),
    CONSTRAINT "teams_name_not_blank" CHECK (length(btrim("name")) > 0),
    CONSTRAINT "teams_slug_not_blank" CHECK (length(btrim("slug")) > 0),
    CONSTRAINT "teams_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "team_categories" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "team_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_categories_period_valid" CHECK (
        "ends_on" IS NULL OR "ends_on" >= "starts_on"
    ),
    CONSTRAINT "team_categories_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "athlete_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "preferred_name" VARCHAR(120),
    "birth_date" DATE NOT NULL,
    "position" VARCHAR(80),
    "status" "AthleteProfileStatus" NOT NULL DEFAULT 'PENDING',
    "duplicate_fingerprint_hash" VARCHAR(80) NOT NULL,
    "is_fictitious" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "athlete_profiles_full_name_not_blank" CHECK (length(btrim("full_name")) > 0),
    CONSTRAINT "athlete_profiles_preferred_name_not_blank" CHECK (
        "preferred_name" IS NULL OR length(btrim("preferred_name")) > 0
    ),
    CONSTRAINT "athlete_profiles_position_not_blank" CHECK (
        "position" IS NULL OR length(btrim("position")) > 0
    ),
    CONSTRAINT "athlete_profiles_fingerprint_valid" CHECK (
        "duplicate_fingerprint_hash" ~ '^v1\.[0-9a-f]{64}$'
    ),
    CONSTRAINT "athlete_profiles_fictitious_only" CHECK ("is_fictitious" = true),
    CONSTRAINT "athlete_profiles_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "athlete_affiliations" (
    "id" UUID NOT NULL,
    "athlete_profile_id" UUID NOT NULL,
    "team_category_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "assigned_by_id" UUID,
    "ended_by_id" UUID,
    "reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "athlete_affiliations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "athlete_affiliations_period_valid" CHECK (
        "ends_on" IS NULL OR "ends_on" >= "starts_on"
    ),
    CONSTRAINT "athlete_affiliations_end_actor_valid" CHECK (
        "ended_by_id" IS NULL OR "ends_on" IS NOT NULL
    ),
    CONSTRAINT "athlete_affiliations_reason_not_blank" CHECK (
        "reason" IS NULL OR length(btrim("reason")) > 0
    )
);

CREATE TABLE "guardians" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "is_fictitious" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guardians_full_name_not_blank" CHECK (length(btrim("full_name")) > 0),
    CONSTRAINT "guardians_contact_required" CHECK (
        ("email" IS NOT NULL AND length(btrim("email")) > 0)
        OR ("phone" IS NOT NULL AND length(btrim("phone")) > 0)
    ),
    CONSTRAINT "guardians_email_normalized" CHECK (
        "email" IS NULL OR "email" = lower(btrim("email"))
    ),
    CONSTRAINT "guardians_fictitious_only" CHECK ("is_fictitious" = true),
    CONSTRAINT "guardians_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "athlete_guardians" (
    "id" UUID NOT NULL,
    "athlete_profile_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "relationship" VARCHAR(80) NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "athlete_guardians_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "athlete_guardians_relationship_not_blank" CHECK (
        length(btrim("relationship")) > 0
    ),
    CONSTRAINT "athlete_guardians_period_valid" CHECK (
        "ends_on" IS NULL OR "ends_on" >= "starts_on"
    )
);

CREATE TABLE "tryouts" (
    "id" UUID NOT NULL,
    "team_category_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(220) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "registration_starts_at" TIMESTAMPTZ(6) NOT NULL,
    "registration_ends_at" TIMESTAMPTZ(6) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "waitlist_capacity" INTEGER,
    "responsible_user_id" UUID NOT NULL,
    "criteria" TEXT,
    "status" "TryoutStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tryouts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tryouts_title_not_blank" CHECK (length(btrim("title")) > 0),
    CONSTRAINT "tryouts_slug_not_blank" CHECK (length(btrim("slug")) > 0),
    CONSTRAINT "tryouts_location_not_blank" CHECK (length(btrim("location")) > 0),
    CONSTRAINT "tryouts_registration_window_valid" CHECK (
        "registration_starts_at" < "registration_ends_at"
        AND "registration_ends_at" <= "starts_at"
    ),
    CONSTRAINT "tryouts_capacity_valid" CHECK ("capacity" > 0),
    CONSTRAINT "tryouts_waitlist_capacity_valid" CHECK (
        "waitlist_capacity" IS NULL OR "waitlist_capacity" >= 0
    ),
    CONSTRAINT "tryouts_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "tryout_registrations" (
    "id" UUID NOT NULL,
    "tryout_id" UUID NOT NULL,
    "applicant_user_id" UUID,
    "converted_athlete_profile_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "birth_date" DATE NOT NULL,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "desired_position" VARCHAR(80),
    "duplicate_fingerprint_hash" VARCHAR(80) NOT NULL,
    "is_fictitious" BOOLEAN NOT NULL DEFAULT true,
    "status" "TryoutRegistrationStatus" NOT NULL DEFAULT 'NEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tryout_registrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tryout_registrations_full_name_not_blank" CHECK (
        length(btrim("full_name")) > 0
    ),
    CONSTRAINT "tryout_registrations_contact_not_blank" CHECK (
        ("email" IS NULL OR length(btrim("email")) > 0)
        AND ("phone" IS NULL OR length(btrim("phone")) > 0)
    ),
    CONSTRAINT "tryout_registrations_email_normalized" CHECK (
        "email" IS NULL OR "email" = lower(btrim("email"))
    ),
    CONSTRAINT "tryout_registrations_position_not_blank" CHECK (
        "desired_position" IS NULL OR length(btrim("desired_position")) > 0
    ),
    CONSTRAINT "tryout_registrations_fingerprint_valid" CHECK (
        "duplicate_fingerprint_hash" ~ '^v1\.[0-9a-f]{64}$'
    ),
    CONSTRAINT "tryout_registrations_fictitious_only" CHECK ("is_fictitious" = true),
    CONSTRAINT "tryout_registrations_conversion_valid" CHECK (
        ("status" = 'CONVERTED' AND "converted_athlete_profile_id" IS NOT NULL)
        OR ("status" <> 'CONVERTED' AND "converted_athlete_profile_id" IS NULL)
    ),
    CONSTRAINT "tryout_registrations_review_valid" CHECK (
        ("reviewed_at" IS NULL AND "reviewed_by_id" IS NULL)
        OR ("reviewed_at" IS NOT NULL AND "reviewed_by_id" IS NOT NULL)
    ),
    CONSTRAINT "tryout_registrations_review_reason_not_blank" CHECK (
        "review_reason" IS NULL OR length(btrim("review_reason")) > 0
    ),
    CONSTRAINT "tryout_registrations_deleted_at_valid" CHECK (
        "deleted_at" IS NULL OR "deleted_at" >= "created_at"
    )
);

CREATE TABLE "guardian_authorizations" (
    "id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "athlete_profile_id" UUID,
    "tryout_registration_id" UUID,
    "private_attachment_id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "status" "GuardianAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "revocation_reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_authorizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guardian_authorizations_version_not_blank" CHECK (
        length(btrim("version")) > 0
    ),
    CONSTRAINT "guardian_authorizations_subject_required" CHECK (
        "athlete_profile_id" IS NOT NULL OR "tryout_registration_id" IS NOT NULL
    ),
    CONSTRAINT "guardian_authorizations_period_valid" CHECK (
        "valid_until" >= "valid_from"
    ),
    CONSTRAINT "guardian_authorizations_verification_valid" CHECK (
        ("status" = 'PENDING' AND "verified_at" IS NULL AND "verified_by_id" IS NULL)
        OR (
            "status" IN ('VALID', 'REVOKED', 'EXPIRED')
            AND "verified_at" IS NOT NULL
            AND "verified_by_id" IS NOT NULL
        )
    ),
    CONSTRAINT "guardian_authorizations_revocation_valid" CHECK (
        (
            "status" = 'REVOKED'
            AND "revoked_at" IS NOT NULL
            AND "revoked_by_id" IS NOT NULL
            AND length(btrim("revocation_reason")) > 0
        )
        OR (
            "status" <> 'REVOKED'
            AND "revoked_at" IS NULL
            AND "revoked_by_id" IS NULL
            AND "revocation_reason" IS NULL
        )
    )
);

CREATE TABLE "tryout_registration_history" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "from_status" "TryoutRegistrationStatus",
    "to_status" "TryoutRegistrationStatus" NOT NULL,
    "changed_by_id" UUID,
    "reason" VARCHAR(250),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tryout_registration_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tryout_registration_history_transition_valid" CHECK (
        "from_status" IS NULL OR "from_status" <> "to_status"
    ),
    CONSTRAINT "tryout_registration_history_reason_not_blank" CHECK (
        "reason" IS NULL OR length(btrim("reason")) > 0
    )
);

CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "kind" "SportsImportKind" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'CREATED',
    "private_attachment_id" UUID,
    "created_by_id" UUID NOT NULL,
    "processed_by_id" UUID,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(100),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_batches_counts_valid" CHECK (
        "total_rows" >= 0
        AND "valid_rows" >= 0
        AND "invalid_rows" >= 0
        AND "imported_rows" >= 0
        AND "valid_rows" + "invalid_rows" <= "total_rows"
        AND "imported_rows" <= "valid_rows"
    ),
    CONSTRAINT "import_batches_error_code_not_blank" CHECK (
        "error_code" IS NULL OR length(btrim("error_code")) > 0
    ),
    CONSTRAINT "import_batches_completion_valid" CHECK (
        (
            "status" IN ('COMPLETED', 'FAILED', 'CANCELLED')
            AND "completed_at" IS NOT NULL
        )
        OR (
            "status" NOT IN ('COMPLETED', 'FAILED', 'CANCELLED')
            AND "completed_at" IS NULL
        )
    ),
    CONSTRAINT "import_batches_started_at_valid" CHECK (
        "started_at" IS NULL OR "started_at" >= "created_at"
    ),
    CONSTRAINT "import_batches_completed_at_valid" CHECK (
        "completed_at" IS NULL
        OR (
            "completed_at" >= "created_at"
            AND ("started_at" IS NULL OR "completed_at" >= "started_at")
        )
    )
);

CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "row_fingerprint_hash" VARCHAR(80) NOT NULL,
    "error_codes" JSONB,
    "target_entity_type" VARCHAR(80),
    "target_entity_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_rows_row_number_valid" CHECK ("row_number" > 0),
    CONSTRAINT "import_rows_fingerprint_valid" CHECK (
        "row_fingerprint_hash" ~ '^v1\.[0-9a-f]{64}$'
    ),
    CONSTRAINT "import_rows_error_codes_valid" CHECK (
        "error_codes" IS NULL OR jsonb_typeof("error_codes") = 'array'
    ),
    CONSTRAINT "import_rows_target_valid" CHECK (
        ("target_entity_type" IS NULL AND "target_entity_id" IS NULL)
        OR (
            length(btrim("target_entity_type")) > 0
            AND "target_entity_id" IS NOT NULL
        )
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "sport_categories_code_key"
ON "sport_categories"("code");

CREATE UNIQUE INDEX "sport_categories_slug_key"
ON "sport_categories"("slug");

CREATE INDEX "sport_categories_kind_is_active_deleted_at_idx"
ON "sport_categories"("kind", "is_active", "deleted_at");

CREATE UNIQUE INDEX "teams_code_key"
ON "teams"("code");

CREATE UNIQUE INDEX "teams_slug_key"
ON "teams"("slug");

CREATE INDEX "teams_is_active_deleted_at_idx"
ON "teams"("is_active", "deleted_at");

CREATE UNIQUE INDEX "team_categories_team_id_category_id_starts_on_key"
ON "team_categories"("team_id", "category_id", "starts_on");

CREATE INDEX "team_categories_team_id_ends_on_deleted_at_idx"
ON "team_categories"("team_id", "ends_on", "deleted_at");

CREATE INDEX "team_categories_category_id_ends_on_deleted_at_idx"
ON "team_categories"("category_id", "ends_on", "deleted_at");

CREATE UNIQUE INDEX "athlete_profiles_user_id_key"
ON "athlete_profiles"("user_id");

CREATE INDEX "athlete_profiles_status_deleted_at_idx"
ON "athlete_profiles"("status", "deleted_at");

CREATE INDEX "athlete_profiles_duplicate_fingerprint_hash_deleted_at_idx"
ON "athlete_profiles"("duplicate_fingerprint_hash", "deleted_at");

CREATE INDEX "athlete_profiles_full_name_deleted_at_idx"
ON "athlete_profiles"("full_name", "deleted_at");

CREATE UNIQUE INDEX "athlete_affiliations_athlete_profile_id_team_category_id_starts_on_key"
ON "athlete_affiliations"("athlete_profile_id", "team_category_id", "starts_on");

CREATE INDEX "athlete_affiliations_athlete_profile_id_ends_on_idx"
ON "athlete_affiliations"("athlete_profile_id", "ends_on");

CREATE INDEX "athlete_affiliations_team_category_id_ends_on_idx"
ON "athlete_affiliations"("team_category_id", "ends_on");

CREATE UNIQUE INDEX "guardians_user_id_key"
ON "guardians"("user_id");

CREATE INDEX "guardians_full_name_deleted_at_idx"
ON "guardians"("full_name", "deleted_at");

CREATE INDEX "guardians_email_deleted_at_idx"
ON "guardians"("email", "deleted_at");

CREATE UNIQUE INDEX "athlete_guardians_athlete_profile_id_guardian_id_starts_on_key"
ON "athlete_guardians"("athlete_profile_id", "guardian_id", "starts_on");

CREATE INDEX "athlete_guardians_athlete_profile_id_ends_on_idx"
ON "athlete_guardians"("athlete_profile_id", "ends_on");

CREATE INDEX "athlete_guardians_guardian_id_ends_on_idx"
ON "athlete_guardians"("guardian_id", "ends_on");

CREATE UNIQUE INDEX "tryouts_slug_key"
ON "tryouts"("slug");

CREATE INDEX "tryouts_status_registration_starts_at_registration_ends_at_idx"
ON "tryouts"("status", "registration_starts_at", "registration_ends_at");

CREATE INDEX "tryouts_team_category_id_starts_at_idx"
ON "tryouts"("team_category_id", "starts_at");

CREATE INDEX "tryouts_responsible_user_id_starts_at_idx"
ON "tryouts"("responsible_user_id", "starts_at");

CREATE UNIQUE INDEX "tryout_registrations_converted_athlete_profile_id_key"
ON "tryout_registrations"("converted_athlete_profile_id");

CREATE INDEX "tryout_registrations_tryout_id_status_created_at_idx"
ON "tryout_registrations"("tryout_id", "status", "created_at");

CREATE INDEX "tryout_registrations_duplicate_fingerprint_hash_deleted_at_idx"
ON "tryout_registrations"("duplicate_fingerprint_hash", "deleted_at");

CREATE INDEX "tryout_registrations_applicant_user_id_created_at_idx"
ON "tryout_registrations"("applicant_user_id", "created_at");

CREATE UNIQUE INDEX "guardian_authorizations_private_attachment_id_key"
ON "guardian_authorizations"("private_attachment_id");

CREATE INDEX "guardian_authorizations_guardian_id_status_valid_until_idx"
ON "guardian_authorizations"("guardian_id", "status", "valid_until");

CREATE INDEX "guardian_authorizations_athlete_profile_id_status_valid_until_idx"
ON "guardian_authorizations"("athlete_profile_id", "status", "valid_until");

CREATE INDEX "guardian_authorizations_tryout_registration_id_status_valid_until_idx"
ON "guardian_authorizations"("tryout_registration_id", "status", "valid_until");

CREATE INDEX "tryout_registration_history_registration_id_occurred_at_idx"
ON "tryout_registration_history"("registration_id", "occurred_at");

CREATE INDEX "tryout_registration_history_changed_by_id_occurred_at_idx"
ON "tryout_registration_history"("changed_by_id", "occurred_at");

CREATE UNIQUE INDEX "import_batches_private_attachment_id_key"
ON "import_batches"("private_attachment_id");

CREATE INDEX "import_batches_kind_status_created_at_idx"
ON "import_batches"("kind", "status", "created_at");

CREATE INDEX "import_batches_created_by_id_created_at_idx"
ON "import_batches"("created_by_id", "created_at");

CREATE UNIQUE INDEX "import_rows_batch_id_row_number_key"
ON "import_rows"("batch_id", "row_number");

CREATE INDEX "import_rows_batch_id_status_idx"
ON "import_rows"("batch_id", "status");

CREATE INDEX "import_rows_target_entity_type_target_entity_id_idx"
ON "import_rows"("target_entity_type", "target_entity_id");

-- AddForeignKey
ALTER TABLE "team_categories"
ADD CONSTRAINT "team_categories_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "teams"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_categories"
ADD CONSTRAINT "team_categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "sport_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_categories"
ADD CONSTRAINT "team_categories_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "athlete_profiles"
ADD CONSTRAINT "athlete_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "athlete_affiliations"
ADD CONSTRAINT "athlete_affiliations_athlete_profile_id_fkey"
FOREIGN KEY ("athlete_profile_id") REFERENCES "athlete_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "athlete_affiliations"
ADD CONSTRAINT "athlete_affiliations_team_category_id_fkey"
FOREIGN KEY ("team_category_id") REFERENCES "team_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "athlete_affiliations"
ADD CONSTRAINT "athlete_affiliations_assigned_by_id_fkey"
FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "athlete_affiliations"
ADD CONSTRAINT "athlete_affiliations_ended_by_id_fkey"
FOREIGN KEY ("ended_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guardians"
ADD CONSTRAINT "guardians_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "athlete_guardians"
ADD CONSTRAINT "athlete_guardians_athlete_profile_id_fkey"
FOREIGN KEY ("athlete_profile_id") REFERENCES "athlete_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "athlete_guardians"
ADD CONSTRAINT "athlete_guardians_guardian_id_fkey"
FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "athlete_guardians"
ADD CONSTRAINT "athlete_guardians_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tryouts"
ADD CONSTRAINT "tryouts_team_category_id_fkey"
FOREIGN KEY ("team_category_id") REFERENCES "team_categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tryouts"
ADD CONSTRAINT "tryouts_responsible_user_id_fkey"
FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tryout_registrations"
ADD CONSTRAINT "tryout_registrations_tryout_id_fkey"
FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tryout_registrations"
ADD CONSTRAINT "tryout_registrations_applicant_user_id_fkey"
FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tryout_registrations"
ADD CONSTRAINT "tryout_registrations_converted_athlete_profile_id_fkey"
FOREIGN KEY ("converted_athlete_profile_id") REFERENCES "athlete_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tryout_registrations"
ADD CONSTRAINT "tryout_registrations_reviewed_by_id_fkey"
FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_guardian_id_fkey"
FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_athlete_profile_id_fkey"
FOREIGN KEY ("athlete_profile_id") REFERENCES "athlete_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_tryout_registration_id_fkey"
FOREIGN KEY ("tryout_registration_id") REFERENCES "tryout_registrations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_private_attachment_id_fkey"
FOREIGN KEY ("private_attachment_id") REFERENCES "private_attachments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_verified_by_id_fkey"
FOREIGN KEY ("verified_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_revoked_by_id_fkey"
FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tryout_registration_history"
ADD CONSTRAINT "tryout_registration_history_registration_id_fkey"
FOREIGN KEY ("registration_id") REFERENCES "tryout_registrations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tryout_registration_history"
ADD CONSTRAINT "tryout_registration_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_batches"
ADD CONSTRAINT "import_batches_private_attachment_id_fkey"
FOREIGN KEY ("private_attachment_id") REFERENCES "private_attachments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_batches"
ADD CONSTRAINT "import_batches_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_batches"
ADD CONSTRAINT "import_batches_processed_by_id_fkey"
FOREIGN KEY ("processed_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "import_rows"
ADD CONSTRAINT "import_rows_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
