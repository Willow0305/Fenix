-- DT-045: cupons de desconto por produto, categoria e público.
-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'PRODUCTS', 'CATEGORIES');

-- CreateEnum
CREATE TYPE "CouponAudience" AS ENUM ('EVERYONE', 'LOGGED_IN', 'ROLES');

-- CreateEnum
CREATE TYPE "CouponRedemptionStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(500),
    "discount_type" "CouponDiscountType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "amount" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "scope" "CouponScope" NOT NULL DEFAULT 'ALL',
    "audience" "CouponAudience" NOT NULL DEFAULT 'EVERYONE',
    "minimum_order_amount" DECIMAL(19,4),
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "max_redemptions" INTEGER,
    "max_per_customer" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_products" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_categories" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "product_category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_roles" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID,
    "customer_email" VARCHAR(180) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_deleted_at_idx" ON "coupons"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "coupon_products_product_id_idx" ON "coupon_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_products_coupon_id_product_id_key" ON "coupon_products"("coupon_id", "product_id");

-- CreateIndex
CREATE INDEX "coupon_categories_product_category_id_idx" ON "coupon_categories"("product_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_categories_coupon_id_product_category_id_key" ON "coupon_categories"("coupon_id", "product_category_id");

-- CreateIndex
CREATE INDEX "coupon_roles_role_id_idx" ON "coupon_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_roles_coupon_id_role_id_key" ON "coupon_roles"("coupon_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_status_idx" ON "coupon_redemptions"("coupon_id", "status");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_status_idx" ON "coupon_redemptions"("coupon_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_customer_email_status_idx" ON "coupon_redemptions"("coupon_id", "customer_email", "status");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_product_category_id_fkey" FOREIGN KEY ("product_category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_roles" ADD CONSTRAINT "coupon_roles_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_roles" ADD CONSTRAINT "coupon_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Percentual e valor coerentes com o tipo, e nunca negativos (DT-045).
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_check" CHECK (
  ("discount_type" = 'PERCENTAGE' AND "percentage" > 0 AND "percentage" <= 100 AND "amount" IS NULL)
  OR ("discount_type" = 'FIXED' AND "amount" > 0 AND "percentage" IS NULL)
);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_limits_check" CHECK (
  ("max_redemptions" IS NULL OR "max_redemptions" > 0)
  AND ("max_per_customer" IS NULL OR "max_per_customer" > 0)
  AND ("minimum_order_amount" IS NULL OR "minimum_order_amount" >= 0)
  AND ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at")
);
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_amount_check" CHECK ("discount_amount" >= 0);
