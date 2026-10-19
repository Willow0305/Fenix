-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "UserTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT', 'RECEIPT', 'INVOICE', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE');

-- CreateEnum
CREATE TYPE "TeamBrandContext" AS ENUM ('OFFICIAL', 'MALE', 'FEMALE', 'BOARD', 'FAVICON', 'COVER', 'OTHER');

-- CreateEnum
CREATE TYPE "AthleteStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "TeamType" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "TeamMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "TryoutStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TryoutRegistrationStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterestedPersonStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MonthlyFeePlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AthletePlanStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MonthlyFeeStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'BOLETO', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'PIX', 'WALLET', 'CARD_CLEARING', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialCategoryNature" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "FinancialObligationType" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "FinancialObligationStatus" AS ENUM ('OPEN', 'SETTLED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialOrigin" AS ENUM ('MANUAL', 'MONTHLY_FEE', 'ORDER', 'REFUND', 'PARTNER_SETTLEMENT', 'TRANSFER', 'OPENING_BALANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialAttachmentType" AS ENUM ('RECEIPT', 'INVOICE', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "CashClosingStatus" AS ENUM ('DRAFT', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('SUPPLIER', 'STORE', 'PROFESSIONAL', 'SPONSOR', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ProfessionalStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'RESERVED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ProductFulfillmentType" AS ENUM ('STOCK', 'MADE_TO_ORDER', 'CAMPAIGN', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'SOLD_OUT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'RESERVATION', 'RELEASE', 'ADJUSTMENT', 'RETURN', 'LOSS');

-- CreateEnum
CREATE TYPE "SalesCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ORDERED', 'IN_PRODUCTION', 'RECEIVED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PartnerSettlementStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ForumVisibility" AS ENUM ('PUBLIC', 'MEMBERS', 'STAFF');

-- CreateEnum
CREATE TYPE "ForumTopicStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ForumPostStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "ForumReactionType" AS ENUM ('LIKE', 'SUPPORT', 'CELEBRATE');

-- CreateEnum
CREATE TYPE "ForumReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE', 'RESTORE', 'CLOSE', 'REOPEN', 'DELETE', 'EDIT');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TRYOUT', 'MATCH', 'FRIENDLY', 'TRAINING', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" VARCHAR(30),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "rotated_from_session_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(250),
    "user_agent_hash" CHAR(64),
    "ip_address_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "UserTokenType" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(140) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_settings" (
    "id" UUID NOT NULL,
    "singleton_key" VARCHAR(40) NOT NULL,
    "team_name" VARCHAR(160) NOT NULL,
    "official_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "history" TEXT,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "social_links" JSONB,
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "address_city" VARCHAR(120),
    "address_state" VARCHAR(80),
    "address_postal_code" VARCHAR(20),
    "address_country" CHAR(2),
    "primary_color" VARCHAR(20),
    "secondary_color" VARCHAR(20),
    "default_currency" CHAR(3) NOT NULL,
    "time_zone" VARCHAR(100) NOT NULL,
    "pix_key_encrypted" TEXT,
    "banking_details_encrypted" TEXT,
    "encryption_key_version" VARCHAR(40),
    "terms_of_use" TEXT,
    "privacy_policy" TEXT,
    "monthly_fee_rules" TEXT,
    "store_rules" TEXT,
    "pickup_instructions" TEXT,
    "notification_settings" JSONB,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_brand_assets" (
    "id" UUID NOT NULL,
    "team_settings_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "context" "TeamBrandContext" NOT NULL,
    "alt_text" VARCHAR(180),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL,
    "storage_provider" VARCHAR(80) NOT NULL,
    "bucket" VARCHAR(180) NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "extension" VARCHAR(20),
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "classification" "DataClassification" NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(140) NOT NULL,
    "entity_type" VARCHAR(140) NOT NULL,
    "entity_id" UUID,
    "reason" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "request_id" UUID,
    "ip_address_hash" CHAR(64),
    "user_agent" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athletes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "preferred_name" VARCHAR(120),
    "birth_date" DATE,
    "document_number_encrypted" TEXT,
    "document_number_hash" CHAR(64),
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "gender" "Gender",
    "position" VARCHAR(80),
    "emergency_contact_name" VARCHAR(160),
    "emergency_contact_phone" VARCHAR(30),
    "guardian_name" VARCHAR(160),
    "guardian_phone" VARCHAR(30),
    "status" "AthleteStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_documents" (
    "id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "document_type" VARCHAR(80) NOT NULL,
    "document_number_encrypted" TEXT,
    "document_number_hash" CHAR(64),
    "issued_on" DATE,
    "expires_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "athlete_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "minimum_age" SMALLINT,
    "maximum_age" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "type" "TeamType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_athletes" (
    "id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "position" VARCHAR(80),
    "status" "TeamMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interested_people" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "converted_athlete_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "birth_date" DATE,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "desired_position" VARCHAR(80),
    "source" VARCHAR(100),
    "notes" TEXT,
    "privacy_notice_version" VARCHAR(40),
    "consent_at" TIMESTAMPTZ(6),
    "status" "InterestedPersonStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "interested_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "applicant_user_id" UUID,
    "interested_person_id" UUID,
    "resulting_athlete_id" UUID,
    "requested_team_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "birth_date" DATE,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "gender" "Gender",
    "desired_position" VARCHAR(80),
    "experience" TEXT,
    "notes" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tryouts" (
    "id" UUID NOT NULL,
    "team_id" UUID,
    "event_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(220),
    "starts_at" TIMESTAMPTZ(6),
    "registration_starts_at" TIMESTAMPTZ(6),
    "registration_ends_at" TIMESTAMPTZ(6),
    "max_slots" INTEGER,
    "status" "TryoutStatus" NOT NULL DEFAULT 'DRAFT',
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tryouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tryout_registrations" (
    "id" UUID NOT NULL,
    "tryout_id" UUID NOT NULL,
    "applicant_user_id" UUID,
    "athlete_id" UUID,
    "interested_person_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "birth_date" DATE,
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "gender" "Gender",
    "desired_position" VARCHAR(80),
    "experience" TEXT,
    "status" "TryoutRegistrationStatus" NOT NULL DEFAULT 'NEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tryout_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_fee_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "status" "MonthlyFeePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" DATE,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "monthly_fee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_monthly_fee_plans" (
    "id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "monthly_fee_plan_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "amount_override" DECIMAL(19,4),
    "currency" CHAR(3),
    "status" "AthletePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "athlete_monthly_fee_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_fees" (
    "id" UUID NOT NULL,
    "athlete_id" UUID NOT NULL,
    "monthly_fee_plan_id" UUID NOT NULL,
    "athlete_monthly_fee_plan_id" UUID,
    "reference_month" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "original_amount" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "additional_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "MonthlyFeeStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monthly_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_fee_payments" (
    "id" UUID NOT NULL,
    "monthly_fee_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "allocated_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "payment_method_id" UUID NOT NULL,
    "payer_user_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(100),
    "external_reference" VARCHAR(200),
    "idempotency_key" VARCHAR(160) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "requested_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "provider_reference" VARCHAR(200),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "institution_name" VARCHAR(160),
    "branch" VARCHAR(40),
    "account_last_four" CHAR(4),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nature" "FinancialCategoryNature" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_obligations" (
    "id" UUID NOT NULL,
    "type" "FinancialObligationType" NOT NULL,
    "status" "FinancialObligationStatus" NOT NULL DEFAULT 'OPEN',
    "category_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "partner_id" UUID,
    "planned_payment_method_id" UUID,
    "settlement_transaction_id" UUID,
    "counterparty_name" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "competence_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "settled_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "payment_method_id" UUID,
    "payment_id" UUID,
    "refund_id" UUID,
    "partner_settlement_id" UUID,
    "reverses_transaction_id" UUID,
    "cash_closing_id" UUID,
    "direction" "FinancialDirection" NOT NULL,
    "origin" "FinancialOrigin" NOT NULL,
    "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "competence_date" DATE NOT NULL,
    "due_date" DATE,
    "occurred_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_by_id" UUID,
    "confirmed_by_id" UUID,
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "reconciled_at" TIMESTAMPTZ(6),
    "reconciled_by_id" UUID,
    "statement_reference" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transfers" (
    "id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "destination_account_id" UUID NOT NULL,
    "debit_transaction_id" UUID NOT NULL,
    "credit_transaction_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "transferred_at" TIMESTAMPTZ(6) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transaction_attachments" (
    "id" UUID NOT NULL,
    "financial_transaction_id" UUID,
    "payment_id" UUID,
    "media_file_id" UUID NOT NULL,
    "type" "FinancialAttachmentType" NOT NULL DEFAULT 'RECEIPT',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_transaction_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closings" (
    "id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "expected_balance" DECIMAL(19,4) NOT NULL,
    "counted_balance" DECIMAL(19,4) NOT NULL,
    "difference_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CashClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "notes" TEXT,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "reopened_by_id" UUID,
    "reopened_at" TIMESTAMPTZ(6),
    "reopening_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "product_category_id" UUID NOT NULL,
    "partner_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "brand" VARCHAR(120),
    "description" TEXT,
    "fulfillment_type" "ProductFulfillmentType" NOT NULL,
    "base_price" DECIMAL(19,4) NOT NULL,
    "promotional_price" DECIMAL(19,4),
    "cost_price" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL,
    "buyer_limit" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "available_from" TIMESTAMPTZ(6),
    "available_until" TIMESTAMPTZ(6),
    "production_lead_days" INTEGER,
    "pickup_instructions" TEXT,
    "commission_type_override" "CommissionType",
    "commission_percentage_override" DECIMAL(7,4),
    "commission_fixed_override" DECIMAL(19,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "alt_text" VARCHAR(180),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "size" VARCHAR(40),
    "color" VARCHAR(80),
    "gender" "Gender",
    "attributes" JSONB,
    "price_override" DECIMAL(19,4),
    "promotional_price_override" DECIMAL(19,4),
    "cost_price_override" DECIMAL(19,4),
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "order_item_id" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_campaigns" (
    "id" UUID NOT NULL,
    "supplier_partner_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "sales_start_at" TIMESTAMPTZ(6) NOT NULL,
    "sales_end_at" TIMESTAMPTZ(6) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "minimum_quantity" INTEGER,
    "maximum_quantity" INTEGER,
    "supplier_ordered_on" DATE,
    "expected_production_on" DATE,
    "expected_arrival_on" DATE,
    "received_on" DATE,
    "pickup_starts_on" DATE,
    "pickup_ends_on" DATE,
    "refund_policy" TEXT,
    "status" "SalesCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "cancellation_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sales_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_campaign_products" (
    "id" UUID NOT NULL,
    "sales_campaign_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "campaign_price" DECIMAL(19,4),
    "minimum_quantity" INTEGER,
    "maximum_quantity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sales_campaign_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_key_hash" CHAR(64),
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "converted_order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "sales_campaign_product_id" UUID,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_user_id" UUID,
    "order_number" VARCHAR(40) NOT NULL,
    "customer_name" VARCHAR(160) NOT NULL,
    "customer_email" VARCHAR(180),
    "customer_phone" VARCHAR(30),
    "subtotal_amount" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "ready_for_pickup_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "sales_campaign_product_id" UUID,
    "partner_id" UUID,
    "product_name" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "selected_attributes" JSONB,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "commission_type_snapshot" "CommissionType",
    "commission_rate_snapshot" DECIMAL(7,4),
    "commission_fixed_snapshot" DECIMAL(19,4),
    "partner_amount_snapshot" DECIMAL(19,4),
    "arrival_notified_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "legal_name" VARCHAR(180) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "type" "PartnerType" NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "document_number_encrypted" TEXT,
    "document_number_hash" CHAR(64),
    "contact_name" VARCHAR(160),
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "description" TEXT,
    "contract_starts_on" DATE,
    "contract_ends_on" DATE,
    "logo_media_file_id" UUID,
    "commission_type" "CommissionType" NOT NULL DEFAULT 'NONE',
    "commission_percentage" DECIMAL(7,4),
    "commission_fixed_amount" DECIMAL(19,4),
    "commission_currency" CHAR(3),
    "contract_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "document_type" VARCHAR(80) NOT NULL,
    "issued_on" DATE,
    "expires_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_professionals" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "profession" VARCHAR(120) NOT NULL,
    "license_number_encrypted" TEXT,
    "license_number_hash" CHAR(64),
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "public_bio" TEXT,
    "status" "ProfessionalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partner_professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_services" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "professional_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(19,4),
    "currency" CHAR(3),
    "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "partner_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_availabilities" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "partner_service_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "professional_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "partner_service_id" UUID NOT NULL,
    "professional_id" UUID,
    "availability_id" UUID,
    "requester_user_id" UUID NOT NULL,
    "athlete_id" UUID,
    "requested_starts_at" TIMESTAMPTZ(6),
    "requested_ends_at" TIMESTAMPTZ(6),
    "scheduled_starts_at" TIMESTAMPTZ(6),
    "scheduled_ends_at" TIMESTAMPTZ(6),
    "quoted_price" DECIMAL(19,4),
    "currency" CHAR(3),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "administrative_notes" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_settlements" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gross_sales_amount" DECIMAL(19,4) NOT NULL,
    "commission_amount" DECIMAL(19,4) NOT NULL,
    "adjustment_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_payable_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PartnerSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "due_date" DATE,
    "paid_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "partner_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_settlement_items" (
    "id" UUID NOT NULL,
    "partner_settlement_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "gross_amount" DECIMAL(19,4) NOT NULL,
    "commission_amount" DECIMAL(19,4) NOT NULL,
    "net_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "location_name" VARCHAR(180),
    "address" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "team_id" UUID,
    "opponent_name" VARCHAR(160) NOT NULL,
    "competition_name" VARCHAR(160),
    "is_home" BOOLEAN NOT NULL DEFAULT true,
    "team_score" INTEGER,
    "opponent_score" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "visibility" "ForumVisibility" NOT NULL DEFAULT 'PUBLIC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topics" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_user_id" UUID,
    "title" VARCHAR(180) NOT NULL,
    "visibility" "ForumVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "ForumTopicStatus" NOT NULL DEFAULT 'DRAFT',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_posts" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "author_user_id" UUID,
    "parent_post_id" UUID,
    "content" TEXT NOT NULL,
    "status" "ForumPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reactions" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ForumReactionType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reports" (
    "id" UUID NOT NULL,
    "topic_id" UUID,
    "post_id" UUID,
    "reporter_user_id" UUID NOT NULL,
    "reason" VARCHAR(180) NOT NULL,
    "details" TEXT,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "resolution" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderation_actions" (
    "id" UUID NOT NULL,
    "topic_id" UUID,
    "post_id" UUID,
    "moderator_user_id" UUID NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_user_id" UUID,
    "cover_media_file_id" UUID,
    "event_id" UUID,
    "forum_topic_id" UUID,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "show_on_home" BOOLEAN NOT NULL DEFAULT false,
    "show_on_forum" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(120) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "delivery_status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "deduplication_key" VARCHAR(160),
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_expires_at_idx" ON "user_sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_tokens_token_hash_key" ON "user_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "user_tokens_user_id_type_expires_at_idx" ON "user_tokens"("user_id", "type", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_deleted_at_name_idx" ON "roles"("deleted_at", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_deleted_at_name_idx" ON "permissions"("deleted_at", "name");

-- CreateIndex
CREATE INDEX "user_roles_role_id_expires_at_idx" ON "user_roles"("role_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_settings_singleton_key_key" ON "team_settings"("singleton_key");

-- CreateIndex
CREATE INDEX "team_brand_assets_media_file_id_idx" ON "team_brand_assets"("media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_brand_assets_team_settings_id_context_key" ON "team_brand_assets"("team_settings_id", "context");

-- CreateIndex
CREATE INDEX "media_files_classification_kind_deleted_at_idx" ON "media_files"("classification", "kind", "deleted_at");

-- CreateIndex
CREATE INDEX "media_files_checksum_sha256_idx" ON "media_files"("checksum_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storage_provider_bucket_object_key_key" ON "media_files"("storage_provider", "bucket", "object_key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "athletes_user_id_key" ON "athletes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "athletes_document_number_hash_key" ON "athletes"("document_number_hash");

-- CreateIndex
CREATE INDEX "athletes_status_deleted_at_idx" ON "athletes"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "athletes_full_name_deleted_at_idx" ON "athletes"("full_name", "deleted_at");

-- CreateIndex
CREATE INDEX "athlete_documents_athlete_id_document_type_deleted_at_idx" ON "athlete_documents"("athlete_id", "document_type", "deleted_at");

-- CreateIndex
CREATE INDEX "athlete_documents_expires_on_idx" ON "athlete_documents"("expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_documents_athlete_id_media_file_id_key" ON "athlete_documents"("athlete_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_deleted_at_idx" ON "categories"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE INDEX "teams_category_id_is_active_deleted_at_idx" ON "teams"("category_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "team_athletes_team_id_status_starts_on_idx" ON "team_athletes"("team_id", "status", "starts_on");

-- CreateIndex
CREATE INDEX "team_athletes_athlete_id_status_idx" ON "team_athletes"("athlete_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_athletes_athlete_id_team_id_starts_on_key" ON "team_athletes"("athlete_id", "team_id", "starts_on");

-- CreateIndex
CREATE UNIQUE INDEX "interested_people_user_id_key" ON "interested_people"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "interested_people_converted_athlete_id_key" ON "interested_people"("converted_athlete_id");

-- CreateIndex
CREATE INDEX "interested_people_status_created_at_idx" ON "interested_people"("status", "created_at");

-- CreateIndex
CREATE INDEX "interested_people_email_deleted_at_idx" ON "interested_people"("email", "deleted_at");

-- CreateIndex
CREATE INDEX "registrations_status_created_at_idx" ON "registrations"("status", "created_at");

-- CreateIndex
CREATE INDEX "registrations_requested_team_id_status_idx" ON "registrations"("requested_team_id", "status");

-- CreateIndex
CREATE INDEX "registrations_applicant_user_id_created_at_idx" ON "registrations"("applicant_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tryouts_event_id_key" ON "tryouts"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "tryouts_slug_key" ON "tryouts"("slug");

-- CreateIndex
CREATE INDEX "tryouts_status_registration_starts_at_registration_ends_at_idx" ON "tryouts"("status", "registration_starts_at", "registration_ends_at");

-- CreateIndex
CREATE INDEX "tryouts_team_id_starts_at_idx" ON "tryouts"("team_id", "starts_at");

-- CreateIndex
CREATE INDEX "tryout_registrations_tryout_id_status_created_at_idx" ON "tryout_registrations"("tryout_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tryout_registrations_athlete_id_created_at_idx" ON "tryout_registrations"("athlete_id", "created_at");

-- CreateIndex
CREATE INDEX "tryout_registrations_applicant_user_id_created_at_idx" ON "tryout_registrations"("applicant_user_id", "created_at");

-- CreateIndex
CREATE INDEX "monthly_fee_plans_status_deleted_at_idx" ON "monthly_fee_plans"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "monthly_fee_plans_valid_from_valid_until_idx" ON "monthly_fee_plans"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "athlete_monthly_fee_plans_athlete_id_status_starts_on_idx" ON "athlete_monthly_fee_plans"("athlete_id", "status", "starts_on");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_monthly_fee_plans_athlete_id_monthly_fee_plan_id_st_key" ON "athlete_monthly_fee_plans"("athlete_id", "monthly_fee_plan_id", "starts_on");

-- CreateIndex
CREATE INDEX "monthly_fees_status_due_date_idx" ON "monthly_fees"("status", "due_date");

-- CreateIndex
CREATE INDEX "monthly_fees_athlete_id_status_idx" ON "monthly_fees"("athlete_id", "status");

-- CreateIndex
CREATE INDEX "monthly_fees_reference_month_status_idx" ON "monthly_fees"("reference_month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_fees_athlete_id_reference_month_key" ON "monthly_fees"("athlete_id", "reference_month");

-- CreateIndex
CREATE INDEX "monthly_fee_payments_payment_id_idx" ON "monthly_fee_payments"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_fee_payments_monthly_fee_id_payment_id_key" ON "monthly_fee_payments"("monthly_fee_id", "payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE INDEX "payment_methods_is_active_deleted_at_idx" ON "payment_methods"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_payer_user_id_created_at_idx" ON "payments"("payer_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_external_reference_key" ON "payments"("provider", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_payment_id_status_idx" ON "refunds"("payment_id", "status");

-- CreateIndex
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_code_key" ON "financial_accounts"("code");

-- CreateIndex
CREATE INDEX "financial_accounts_is_active_type_deleted_at_idx" ON "financial_accounts"("is_active", "type", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_code_key" ON "financial_categories"("code");

-- CreateIndex
CREATE INDEX "financial_categories_nature_is_active_deleted_at_idx" ON "financial_categories"("nature", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "financial_categories_parent_id_idx" ON "financial_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE INDEX "cost_centers_is_active_deleted_at_idx" ON "cost_centers"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "cost_centers_parent_id_idx" ON "cost_centers"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_obligations_settlement_transaction_id_key" ON "financial_obligations"("settlement_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_obligations_idempotency_key_key" ON "financial_obligations"("idempotency_key");

-- CreateIndex
CREATE INDEX "financial_obligations_type_status_due_date_idx" ON "financial_obligations"("type", "status", "due_date");

-- CreateIndex
CREATE INDEX "financial_obligations_partner_id_status_idx" ON "financial_obligations"("partner_id", "status");

-- CreateIndex
CREATE INDEX "financial_obligations_planned_payment_method_id_due_date_idx" ON "financial_obligations"("planned_payment_method_id", "due_date");

-- CreateIndex
CREATE INDEX "financial_obligations_category_id_competence_date_idx" ON "financial_obligations"("category_id", "competence_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_payment_id_key" ON "financial_transactions"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_refund_id_key" ON "financial_transactions"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_partner_settlement_id_key" ON "financial_transactions"("partner_settlement_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_idempotency_key_key" ON "financial_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "financial_transactions_account_id_status_occurred_at_idx" ON "financial_transactions"("account_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_category_id_competence_date_idx" ON "financial_transactions"("category_id", "competence_date");

-- CreateIndex
CREATE INDEX "financial_transactions_cost_center_id_competence_date_idx" ON "financial_transactions"("cost_center_id", "competence_date");

-- CreateIndex
CREATE INDEX "financial_transactions_payment_method_id_occurred_at_idx" ON "financial_transactions"("payment_method_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_origin_status_idx" ON "financial_transactions"("origin", "status");

-- CreateIndex
CREATE INDEX "financial_transactions_reverses_transaction_id_idx" ON "financial_transactions"("reverses_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transfers_debit_transaction_id_key" ON "financial_transfers"("debit_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transfers_credit_transaction_id_key" ON "financial_transfers"("credit_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transfers_idempotency_key_key" ON "financial_transfers"("idempotency_key");

-- CreateIndex
CREATE INDEX "financial_transfers_source_account_id_transferred_at_idx" ON "financial_transfers"("source_account_id", "transferred_at");

-- CreateIndex
CREATE INDEX "financial_transfers_destination_account_id_transferred_at_idx" ON "financial_transfers"("destination_account_id", "transferred_at");

-- CreateIndex
CREATE INDEX "financial_transaction_attachments_financial_transaction_id__idx" ON "financial_transaction_attachments"("financial_transaction_id", "type", "deleted_at");

-- CreateIndex
CREATE INDEX "financial_transaction_attachments_payment_id_type_deleted_a_idx" ON "financial_transaction_attachments"("payment_id", "type", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transaction_attachments_financial_transaction_id__key" ON "financial_transaction_attachments"("financial_transaction_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transaction_attachments_payment_id_media_file_id_key" ON "financial_transaction_attachments"("payment_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closings_idempotency_key_key" ON "cash_closings"("idempotency_key");

-- CreateIndex
CREATE INDEX "cash_closings_financial_account_id_status_period_end_idx" ON "cash_closings"("financial_account_id", "status", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closings_financial_account_id_period_start_period_end_key" ON "cash_closings"("financial_account_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_is_active_deleted_at_idx" ON "product_categories"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_product_category_id_status_deleted_at_idx" ON "products"("product_category_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "products_partner_id_status_idx" ON "products"("partner_id", "status");

-- CreateIndex
CREATE INDEX "products_fulfillment_type_status_available_from_available_u_idx" ON "products"("fulfillment_type", "status", "available_from", "available_until");

-- CreateIndex
CREATE INDEX "product_images_product_id_sort_order_deleted_at_idx" ON "product_images"("product_id", "sort_order", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_media_file_id_key" ON "product_images"("product_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_active_deleted_at_idx" ON "product_variants"("product_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "product_variants_minimum_stock_is_active_idx" ON "product_variants"("minimum_stock", "is_active");

-- CreateIndex
CREATE INDEX "inventory_movements_product_variant_id_occurred_at_idx" ON "inventory_movements"("product_variant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_movements_order_item_id_type_idx" ON "inventory_movements"("order_item_id", "type");

-- CreateIndex
CREATE INDEX "inventory_movements_type_occurred_at_idx" ON "inventory_movements"("type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_campaigns_slug_key" ON "sales_campaigns"("slug");

-- CreateIndex
CREATE INDEX "sales_campaigns_status_sales_start_at_sales_end_at_idx" ON "sales_campaigns"("status", "sales_start_at", "sales_end_at");

-- CreateIndex
CREATE INDEX "sales_campaigns_supplier_partner_id_status_idx" ON "sales_campaigns"("supplier_partner_id", "status");

-- CreateIndex
CREATE INDEX "sales_campaign_products_product_id_is_active_deleted_at_idx" ON "sales_campaign_products"("product_id", "is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_campaign_products_sales_campaign_id_product_id_key" ON "sales_campaign_products"("sales_campaign_id", "product_id");

-- CreateIndex
CREATE INDEX "favorites_product_id_idx" ON "favorites"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_product_id_key" ON "favorites"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_converted_order_id_key" ON "carts"("converted_order_id");

-- CreateIndex
CREATE INDEX "carts_user_id_status_expires_at_idx" ON "carts"("user_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "carts_guest_key_hash_status_idx" ON "carts"("guest_key_hash", "status");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_product_variant_id_idx" ON "cart_items"("cart_id", "product_variant_id");

-- CreateIndex
CREATE INDEX "cart_items_sales_campaign_product_id_idx" ON "cart_items"("sales_campaign_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_user_id_created_at_idx" ON "orders"("customer_user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_email_created_at_idx" ON "orders"("customer_email", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_variant_id_created_at_idx" ON "order_items"("product_variant_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_sales_campaign_product_id_created_at_idx" ON "order_items"("sales_campaign_product_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_partner_id_created_at_idx" ON "order_items"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "partners_document_number_hash_key" ON "partners"("document_number_hash");

-- CreateIndex
CREATE INDEX "partners_status_type_deleted_at_idx" ON "partners"("status", "type", "deleted_at");

-- CreateIndex
CREATE INDEX "partners_display_name_idx" ON "partners"("display_name");

-- CreateIndex
CREATE INDEX "partner_documents_partner_id_document_type_deleted_at_idx" ON "partner_documents"("partner_id", "document_type", "deleted_at");

-- CreateIndex
CREATE INDEX "partner_documents_expires_on_idx" ON "partner_documents"("expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "partner_documents_partner_id_media_file_id_key" ON "partner_documents"("partner_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_professionals_user_id_key" ON "partner_professionals"("user_id");

-- CreateIndex
CREATE INDEX "partner_professionals_partner_id_status_deleted_at_idx" ON "partner_professionals"("partner_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "partner_professionals_profession_idx" ON "partner_professionals"("profession");

-- CreateIndex
CREATE UNIQUE INDEX "partner_professionals_partner_id_license_number_hash_key" ON "partner_professionals"("partner_id", "license_number_hash");

-- CreateIndex
CREATE INDEX "partner_services_partner_id_status_deleted_at_idx" ON "partner_services"("partner_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "partner_services_professional_id_status_idx" ON "partner_services"("professional_id", "status");

-- CreateIndex
CREATE INDEX "professional_availabilities_professional_id_starts_at_ends__idx" ON "professional_availabilities"("professional_id", "starts_at", "ends_at", "status");

-- CreateIndex
CREATE INDEX "professional_availabilities_partner_service_id_starts_at_idx" ON "professional_availabilities"("partner_service_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_availability_id_key" ON "appointments"("availability_id");

-- CreateIndex
CREATE INDEX "appointments_requester_user_id_status_created_at_idx" ON "appointments"("requester_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "appointments_professional_id_scheduled_starts_at_idx" ON "appointments"("professional_id", "scheduled_starts_at");

-- CreateIndex
CREATE INDEX "appointments_partner_service_id_status_idx" ON "appointments"("partner_service_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_settlements_idempotency_key_key" ON "partner_settlements"("idempotency_key");

-- CreateIndex
CREATE INDEX "partner_settlements_partner_id_status_period_end_idx" ON "partner_settlements"("partner_id", "status", "period_end");

-- CreateIndex
CREATE INDEX "partner_settlements_status_due_date_idx" ON "partner_settlements"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "partner_settlement_items_order_item_id_key" ON "partner_settlement_items"("order_item_id");

-- CreateIndex
CREATE INDEX "partner_settlement_items_partner_settlement_id_idx" ON "partner_settlement_items"("partner_settlement_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE INDEX "news_categories_is_active_deleted_at_idx" ON "news_categories"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_starts_at_idx" ON "events"("status", "starts_at");

-- CreateIndex
CREATE INDEX "events_type_starts_at_idx" ON "events"("type", "starts_at");

-- CreateIndex
CREATE INDEX "events_is_public_published_at_idx" ON "events"("is_public", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_event_id_key" ON "matches"("event_id");

-- CreateIndex
CREATE INDEX "matches_team_id_event_id_idx" ON "matches"("team_id", "event_id");

-- CreateIndex
CREATE INDEX "matches_opponent_name_idx" ON "matches"("opponent_name");

-- CreateIndex
CREATE UNIQUE INDEX "forum_categories_slug_key" ON "forum_categories"("slug");

-- CreateIndex
CREATE INDEX "forum_categories_visibility_is_active_deleted_at_idx" ON "forum_categories"("visibility", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "forum_topics_category_id_status_is_pinned_created_at_idx" ON "forum_topics"("category_id", "status", "is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "forum_topics_author_user_id_created_at_idx" ON "forum_topics"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_topics_visibility_status_idx" ON "forum_topics"("visibility", "status");

-- CreateIndex
CREATE INDEX "forum_posts_topic_id_status_created_at_idx" ON "forum_posts"("topic_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "forum_posts_author_user_id_created_at_idx" ON "forum_posts"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_posts_parent_post_id_idx" ON "forum_posts"("parent_post_id");

-- CreateIndex
CREATE INDEX "forum_reactions_post_id_type_idx" ON "forum_reactions"("post_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reactions_post_id_user_id_key" ON "forum_reactions"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_reports_status_created_at_idx" ON "forum_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "forum_reports_topic_id_idx" ON "forum_reports"("topic_id");

-- CreateIndex
CREATE INDEX "forum_reports_post_id_idx" ON "forum_reports"("post_id");

-- CreateIndex
CREATE INDEX "forum_reports_reporter_user_id_created_at_idx" ON "forum_reports"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_moderation_actions_topic_id_created_at_idx" ON "forum_moderation_actions"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_moderation_actions_post_id_created_at_idx" ON "forum_moderation_actions"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_moderation_actions_moderator_user_id_created_at_idx" ON "forum_moderation_actions"("moderator_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "news_forum_topic_id_key" ON "news"("forum_topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- CreateIndex
CREATE INDEX "news_status_scheduled_at_published_at_idx" ON "news"("status", "scheduled_at", "published_at");

-- CreateIndex
CREATE INDEX "news_show_on_home_status_published_at_idx" ON "news"("show_on_home", "status", "published_at");

-- CreateIndex
CREATE INDEX "news_show_on_forum_status_published_at_idx" ON "news"("show_on_forum", "status", "published_at");

-- CreateIndex
CREATE INDEX "news_event_id_idx" ON "news"("event_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_delivery_status_scheduled_at_idx" ON "notifications"("delivery_status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_deduplication_key_key" ON "notifications"("user_id", "deduplication_key");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_rotated_from_session_id_fkey" FOREIGN KEY ("rotated_from_session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_settings" ADD CONSTRAINT "team_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_brand_assets" ADD CONSTRAINT "team_brand_assets_team_settings_id_fkey" FOREIGN KEY ("team_settings_id") REFERENCES "team_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_brand_assets" ADD CONSTRAINT "team_brand_assets_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_documents" ADD CONSTRAINT "athlete_documents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_documents" ADD CONSTRAINT "athlete_documents_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_athletes" ADD CONSTRAINT "team_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_athletes" ADD CONSTRAINT "team_athletes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interested_people" ADD CONSTRAINT "interested_people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interested_people" ADD CONSTRAINT "interested_people_converted_athlete_id_fkey" FOREIGN KEY ("converted_athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_interested_person_id_fkey" FOREIGN KEY ("interested_person_id") REFERENCES "interested_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_resulting_athlete_id_fkey" FOREIGN KEY ("resulting_athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_requested_team_id_fkey" FOREIGN KEY ("requested_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryout_registrations" ADD CONSTRAINT "tryout_registrations_tryout_id_fkey" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryout_registrations" ADD CONSTRAINT "tryout_registrations_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryout_registrations" ADD CONSTRAINT "tryout_registrations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryout_registrations" ADD CONSTRAINT "tryout_registrations_interested_person_id_fkey" FOREIGN KEY ("interested_person_id") REFERENCES "interested_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryout_registrations" ADD CONSTRAINT "tryout_registrations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_monthly_fee_plans" ADD CONSTRAINT "athlete_monthly_fee_plans_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_monthly_fee_plans" ADD CONSTRAINT "athlete_monthly_fee_plans_monthly_fee_plan_id_fkey" FOREIGN KEY ("monthly_fee_plan_id") REFERENCES "monthly_fee_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fees" ADD CONSTRAINT "monthly_fees_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fees" ADD CONSTRAINT "monthly_fees_monthly_fee_plan_id_fkey" FOREIGN KEY ("monthly_fee_plan_id") REFERENCES "monthly_fee_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fees" ADD CONSTRAINT "monthly_fees_athlete_monthly_fee_plan_id_fkey" FOREIGN KEY ("athlete_monthly_fee_plan_id") REFERENCES "athlete_monthly_fee_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fees" ADD CONSTRAINT "monthly_fees_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fees" ADD CONSTRAINT "monthly_fees_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fee_payments" ADD CONSTRAINT "monthly_fee_payments_monthly_fee_id_fkey" FOREIGN KEY ("monthly_fee_id") REFERENCES "monthly_fees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fee_payments" ADD CONSTRAINT "monthly_fee_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fee_payments" ADD CONSTRAINT "monthly_fee_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_planned_payment_method_id_fkey" FOREIGN KEY ("planned_payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_settlement_transaction_id_fkey" FOREIGN KEY ("settlement_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_partner_settlement_id_fkey" FOREIGN KEY ("partner_settlement_id") REFERENCES "partner_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cash_closing_id_fkey" FOREIGN KEY ("cash_closing_id") REFERENCES "cash_closings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_debit_transaction_id_fkey" FOREIGN KEY ("debit_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_credit_transaction_id_fkey" FOREIGN KEY ("credit_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction_attachments" ADD CONSTRAINT "financial_transaction_attachments_financial_transaction_id_fkey" FOREIGN KEY ("financial_transaction_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction_attachments" ADD CONSTRAINT "financial_transaction_attachments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction_attachments" ADD CONSTRAINT "financial_transaction_attachments_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_campaigns" ADD CONSTRAINT "sales_campaigns_supplier_partner_id_fkey" FOREIGN KEY ("supplier_partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_campaigns" ADD CONSTRAINT "sales_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_campaign_products" ADD CONSTRAINT "sales_campaign_products_sales_campaign_id_fkey" FOREIGN KEY ("sales_campaign_id") REFERENCES "sales_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_campaign_products" ADD CONSTRAINT "sales_campaign_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_converted_order_id_fkey" FOREIGN KEY ("converted_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_sales_campaign_product_id_fkey" FOREIGN KEY ("sales_campaign_product_id") REFERENCES "sales_campaign_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sales_campaign_product_id_fkey" FOREIGN KEY ("sales_campaign_product_id") REFERENCES "sales_campaign_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_media_file_id_fkey" FOREIGN KEY ("logo_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_professionals" ADD CONSTRAINT "partner_professionals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_professionals" ADD CONSTRAINT "partner_professionals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_services" ADD CONSTRAINT "partner_services_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_services" ADD CONSTRAINT "partner_services_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "partner_professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_availabilities" ADD CONSTRAINT "professional_availabilities_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "partner_professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_availabilities" ADD CONSTRAINT "professional_availabilities_partner_service_id_fkey" FOREIGN KEY ("partner_service_id") REFERENCES "partner_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_partner_service_id_fkey" FOREIGN KEY ("partner_service_id") REFERENCES "partner_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "partner_professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "professional_availabilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlement_items" ADD CONSTRAINT "partner_settlement_items_partner_settlement_id_fkey" FOREIGN KEY ("partner_settlement_id") REFERENCES "partner_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_settlement_items" ADD CONSTRAINT "partner_settlement_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "forum_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reactions" ADD CONSTRAINT "forum_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderation_actions" ADD CONSTRAINT "forum_moderation_actions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderation_actions" ADD CONSTRAINT "forum_moderation_actions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderation_actions" ADD CONSTRAINT "forum_moderation_actions_moderator_user_id_fkey" FOREIGN KEY ("moderator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_forum_topic_id_fkey" FOREIGN KEY ("forum_topic_id") REFERENCES "forum_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
