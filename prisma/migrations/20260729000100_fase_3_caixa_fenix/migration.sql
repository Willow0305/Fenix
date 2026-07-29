-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialCategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FinancialChargeStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialSurplusDisposition" AS ENUM ('CREDIT', 'RETURN_PENDING', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "PaymentCreditStatus" AS ENUM ('OPEN', 'PARTIALLY_USED', 'USED', 'REFUND_PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialTransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialObligationType" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "FinancialObligationStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "type" "FinancialCategoryType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "status" "FinancialPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_plan_versions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "billing_day" SMALLINT NOT NULL,
    "rules_snapshot" JSONB,
    "effective_from" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_charges" (
    "id" UUID NOT NULL,
    "reference_code" VARCHAR(80) NOT NULL,
    "plan_version_id" UUID,
    "description" VARCHAR(220) NOT NULL,
    "competence" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "original_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "FinancialChargeStatus" NOT NULL DEFAULT 'OPEN',
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_payments" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "private_attachment_id" UUID,
    "external_reference" VARCHAR(120),
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "FinancialPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_reconciliations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_surpluses" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "disposition" "FinancialSurplusDisposition" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_surpluses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_credits" (
    "id" UUID NOT NULL,
    "source_payment_id" UUID NOT NULL,
    "original_amount" DECIMAL(19,4) NOT NULL,
    "remaining_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "PaymentCreditStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transfers" (
    "id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "description" VARCHAR(220) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "FinancialTransferStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "initiated_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(250),
    "reversed_by_id" UUID,
    "reversed_at" TIMESTAMPTZ(6),
    "reversal_reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_obligations" (
    "id" UUID NOT NULL,
    "type" "FinancialObligationType" NOT NULL,
    "status" "FinancialObligationStatus" NOT NULL DEFAULT 'OPEN',
    "category_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "account_id" UUID,
    "reference_code" VARCHAR(80) NOT NULL,
    "description" VARCHAR(220) NOT NULL,
    "counterparty_ref" VARCHAR(160),
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "opening_balance" DECIMAL(19,4) NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_by_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closings" (
    "id" UUID NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "opening_balance" DECIMAL(19,4) NOT NULL,
    "inflows" DECIMAL(19,4) NOT NULL,
    "outflows" DECIMAL(19,4) NOT NULL,
    "adjustments" DECIMAL(19,4) NOT NULL,
    "expected_final_balance" DECIMAL(19,4) NOT NULL,
    "counted_final_balance" DECIMAL(19,4) NOT NULL,
    "difference_amount" DECIMAL(19,4) NOT NULL,
    "reason" VARCHAR(250),
    "closed_by_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID,
    "cost_center_id" UUID,
    "payment_id" UUID,
    "transfer_id" UUID,
    "obligation_id" UUID,
    "cash_session_id" UUID,
    "reversal_of_id" UUID,
    "type" "FinancialTransactionType" NOT NULL,
    "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "description" VARCHAR(220) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(250),
    "reversed_by_id" UUID,
    "reversed_at" TIMESTAMPTZ(6),
    "reversal_reason" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_code_key" ON "financial_accounts"("code");

-- CreateIndex
CREATE INDEX "financial_accounts_is_active_deleted_at_idx" ON "financial_accounts"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_code_key" ON "financial_categories"("code");

-- CreateIndex
CREATE INDEX "financial_categories_type_is_active_deleted_at_idx" ON "financial_categories"("type", "is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE INDEX "cost_centers_is_active_deleted_at_idx" ON "cost_centers"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_plans_code_key" ON "financial_plans"("code");

-- CreateIndex
CREATE INDEX "financial_plans_status_deleted_at_idx" ON "financial_plans"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "financial_plan_versions_plan_id_effective_from_idx" ON "financial_plan_versions"("plan_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "financial_plan_versions_plan_id_version_key" ON "financial_plan_versions"("plan_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "financial_charges_reference_code_key" ON "financial_charges"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "financial_charges_idempotency_key_hash_key" ON "financial_charges"("idempotency_key_hash");

-- CreateIndex
CREATE INDEX "financial_charges_status_due_date_idx" ON "financial_charges"("status", "due_date");

-- CreateIndex
CREATE INDEX "financial_charges_competence_status_idx" ON "financial_charges"("competence", "status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_payments_private_attachment_id_key" ON "financial_payments"("private_attachment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_payments_idempotency_key_hash_key" ON "financial_payments"("idempotency_key_hash");

-- CreateIndex
CREATE INDEX "financial_payments_status_paid_at_idx" ON "financial_payments"("status", "paid_at");

-- CreateIndex
CREATE INDEX "financial_payments_account_id_paid_at_idx" ON "financial_payments"("account_id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_reconciliations_payment_id_key" ON "financial_reconciliations"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_reconciliations_idempotency_key_hash_key" ON "financial_reconciliations"("idempotency_key_hash");

-- CreateIndex
CREATE INDEX "financial_reconciliations_created_by_id_created_at_idx" ON "financial_reconciliations"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_allocations_charge_id_created_at_idx" ON "payment_allocations"("charge_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_allocations_reconciliation_id_idx" ON "payment_allocations"("reconciliation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_charge_id_key" ON "payment_allocations"("payment_id", "charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_surpluses_payment_id_key" ON "payment_surpluses"("payment_id");

-- CreateIndex
CREATE INDEX "payment_surpluses_disposition_created_at_idx" ON "payment_surpluses"("disposition", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_credits_source_payment_id_key" ON "payment_credits"("source_payment_id");

-- CreateIndex
CREATE INDEX "payment_credits_status_created_at_idx" ON "payment_credits"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transfers_idempotency_key_hash_key" ON "financial_transfers"("idempotency_key_hash");

-- CreateIndex
CREATE INDEX "financial_transfers_status_occurred_at_idx" ON "financial_transfers"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transfers_source_account_id_occurred_at_idx" ON "financial_transfers"("source_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transfers_target_account_id_occurred_at_idx" ON "financial_transfers"("target_account_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_obligations_reference_code_key" ON "financial_obligations"("reference_code");

-- CreateIndex
CREATE INDEX "financial_obligations_type_status_due_date_idx" ON "financial_obligations"("type", "status", "due_date");

-- CreateIndex
CREATE INDEX "financial_obligations_category_id_due_date_idx" ON "financial_obligations"("category_id", "due_date");

-- CreateIndex
CREATE INDEX "financial_obligations_cost_center_id_due_date_idx" ON "financial_obligations"("cost_center_id", "due_date");

-- CreateIndex
CREATE INDEX "cash_sessions_account_id_status_opened_at_idx" ON "cash_sessions"("account_id", "status", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closings_cash_session_id_key" ON "cash_closings"("cash_session_id");

-- CreateIndex
CREATE INDEX "cash_closings_closed_by_id_closed_at_idx" ON "cash_closings"("closed_by_id", "closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_reversal_of_id_key" ON "financial_transactions"("reversal_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_idempotency_key_hash_key" ON "financial_transactions"("idempotency_key_hash");

-- CreateIndex
CREATE INDEX "financial_transactions_account_id_status_occurred_at_idx" ON "financial_transactions"("account_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_category_id_status_occurred_at_idx" ON "financial_transactions"("category_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_cost_center_id_status_occurred_at_idx" ON "financial_transactions"("cost_center_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_payment_id_idx" ON "financial_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "financial_transactions_transfer_id_idx" ON "financial_transactions"("transfer_id");

-- CreateIndex
CREATE INDEX "financial_transactions_obligation_id_idx" ON "financial_transactions"("obligation_id");

-- CreateIndex
CREATE INDEX "financial_transactions_cash_session_id_status_occurred_at_idx" ON "financial_transactions"("cash_session_id", "status", "occurred_at");

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_plan_versions" ADD CONSTRAINT "financial_plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "financial_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_plan_versions" ADD CONSTRAINT "financial_plan_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_charges" ADD CONSTRAINT "financial_charges_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "financial_plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_charges" ADD CONSTRAINT "financial_charges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_private_attachment_id_fkey" FOREIGN KEY ("private_attachment_id") REFERENCES "private_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_payments" ADD CONSTRAINT "financial_payments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "financial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "financial_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "financial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "financial_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_surpluses" ADD CONSTRAINT "payment_surpluses_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "financial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_credits" ADD CONSTRAINT "payment_credits_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "financial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transfers" ADD CONSTRAINT "financial_transfers_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "financial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "financial_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "financial_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "financial_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 3 accounting invariants. Money is always exact and the first vertical
-- slice operates only in BRL.
ALTER TABLE "financial_accounts"
  ADD CONSTRAINT "financial_accounts_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "financial_plan_versions"
  ADD CONSTRAINT "financial_plan_versions_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_plan_versions_currency_brl_check" CHECK ("currency" = 'BRL'),
  ADD CONSTRAINT "financial_plan_versions_billing_day_check" CHECK ("billing_day" BETWEEN 1 AND 28);

ALTER TABLE "financial_charges"
  ADD CONSTRAINT "financial_charges_amount_positive_check" CHECK ("original_amount" > 0),
  ADD CONSTRAINT "financial_charges_currency_brl_check" CHECK ("currency" = 'BRL'),
  ADD CONSTRAINT "financial_charges_competence_first_day_check"
    CHECK (EXTRACT(DAY FROM "competence") = 1);

ALTER TABLE "financial_payments"
  ADD CONSTRAINT "financial_payments_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_payments_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_positive_check" CHECK ("amount" > 0);

ALTER TABLE "payment_surpluses"
  ADD CONSTRAINT "payment_surpluses_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_surpluses_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "payment_credits"
  ADD CONSTRAINT "payment_credits_amounts_check"
    CHECK ("original_amount" > 0 AND "remaining_amount" >= 0 AND "remaining_amount" <= "original_amount"),
  ADD CONSTRAINT "payment_credits_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "financial_transfers"
  ADD CONSTRAINT "financial_transfers_accounts_different_check"
    CHECK ("source_account_id" <> "target_account_id"),
  ADD CONSTRAINT "financial_transfers_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_transfers_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "financial_obligations"
  ADD CONSTRAINT "financial_obligations_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_obligations_currency_brl_check" CHECK ("currency" = 'BRL');

ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_opening_balance_nonnegative_check" CHECK ("opening_balance" >= 0);

ALTER TABLE "cash_closings"
  ADD CONSTRAINT "cash_closings_balances_check"
    CHECK (
      "opening_balance" >= 0
      AND "inflows" >= 0
      AND "outflows" >= 0
      AND "expected_final_balance" = "opening_balance" + "inflows" - "outflows" + "adjustments"
      AND "difference_amount" = "counted_final_balance" - "expected_final_balance"
    );

ALTER TABLE "financial_transactions"
  ADD CONSTRAINT "financial_transactions_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "financial_transactions_currency_brl_check" CHECK ("currency" = 'BRL'),
  ADD CONSTRAINT "financial_transactions_source_shape_check"
    CHECK (
      (
        "type" IN ('INCOME', 'EXPENSE', 'ADJUSTMENT')
        AND "transfer_id" IS NULL
        AND "reversal_of_id" IS NULL
      )
      OR (
        "type" IN ('TRANSFER_IN', 'TRANSFER_OUT')
        AND "transfer_id" IS NOT NULL
        AND "category_id" IS NULL
        AND "reversal_of_id" IS NULL
      )
      OR (
        "type" = 'REVERSAL'
        AND "reversal_of_id" IS NOT NULL
      )
    );

-- Only one cash session may remain open for an account.
CREATE UNIQUE INDEX "cash_sessions_one_open_per_account_key"
  ON "cash_sessions" ("account_id")
  WHERE "status" = 'OPEN';

-- Plan versions and reconciliations are immutable snapshots.
CREATE OR REPLACE FUNCTION "fenix_block_immutable_financial_snapshot"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial snapshot is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "financial_plan_versions_immutable"
  BEFORE UPDATE OR DELETE ON "financial_plan_versions"
  FOR EACH ROW EXECUTE FUNCTION "fenix_block_immutable_financial_snapshot"();

CREATE TRIGGER "financial_reconciliations_immutable"
  BEFORE UPDATE OR DELETE ON "financial_reconciliations"
  FOR EACH ROW EXECUTE FUNCTION "fenix_block_immutable_financial_snapshot"();

CREATE TRIGGER "payment_allocations_immutable"
  BEFORE UPDATE OR DELETE ON "payment_allocations"
  FOR EACH ROW EXECUTE FUNCTION "fenix_block_immutable_financial_snapshot"();

CREATE TRIGGER "cash_closings_immutable"
  BEFORE UPDATE OR DELETE ON "cash_closings"
  FOR EACH ROW EXECUTE FUNCTION "fenix_block_immutable_financial_snapshot"();

-- An approved ledger row can only transition to REVERSED. Its accounting
-- dimensions and value remain unchanged; the correcting entry is separate.
CREATE OR REPLACE FUNCTION "fenix_protect_approved_financial_transaction"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'approved financial transaction cannot be deleted'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('APPROVED', 'REVERSED') THEN
    IF NOT (
      OLD."status" = 'APPROVED'
      AND NEW."status" = 'REVERSED'
      AND NEW."reversed_by_id" IS NOT NULL
      AND NEW."reversed_at" IS NOT NULL
      AND NEW."reversal_reason" IS NOT NULL
      AND NEW."account_id" IS NOT DISTINCT FROM OLD."account_id"
      AND NEW."category_id" IS NOT DISTINCT FROM OLD."category_id"
      AND NEW."cost_center_id" IS NOT DISTINCT FROM OLD."cost_center_id"
      AND NEW."payment_id" IS NOT DISTINCT FROM OLD."payment_id"
      AND NEW."transfer_id" IS NOT DISTINCT FROM OLD."transfer_id"
      AND NEW."obligation_id" IS NOT DISTINCT FROM OLD."obligation_id"
      AND NEW."cash_session_id" IS NOT DISTINCT FROM OLD."cash_session_id"
      AND NEW."reversal_of_id" IS NOT DISTINCT FROM OLD."reversal_of_id"
      AND NEW."type" IS NOT DISTINCT FROM OLD."type"
      AND NEW."amount" IS NOT DISTINCT FROM OLD."amount"
      AND NEW."currency" IS NOT DISTINCT FROM OLD."currency"
      AND NEW."description" IS NOT DISTINCT FROM OLD."description"
      AND NEW."occurred_at" IS NOT DISTINCT FROM OLD."occurred_at"
      AND NEW."idempotency_key_hash" IS NOT DISTINCT FROM OLD."idempotency_key_hash"
      AND NEW."created_by_id" IS NOT DISTINCT FROM OLD."created_by_id"
      AND NEW."approved_by_id" IS NOT DISTINCT FROM OLD."approved_by_id"
      AND NEW."approved_at" IS NOT DISTINCT FROM OLD."approved_at"
      AND NEW."rejected_by_id" IS NOT DISTINCT FROM OLD."rejected_by_id"
      AND NEW."rejected_at" IS NOT DISTINCT FROM OLD."rejected_at"
      AND NEW."rejection_reason" IS NOT DISTINCT FROM OLD."rejection_reason"
      AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at"
    ) THEN
      RAISE EXCEPTION 'approved financial transaction is immutable; create a reversal'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "financial_transactions_protect_approved"
  BEFORE UPDATE OR DELETE ON "financial_transactions"
  FOR EACH ROW EXECUTE FUNCTION "fenix_protect_approved_financial_transaction"();
