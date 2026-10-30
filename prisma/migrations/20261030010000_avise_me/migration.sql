-- "Avise-me quando chegar" (DT-081): pedido de aviso por variação, só com conta.
CREATE TABLE "stock_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_alerts_user_id_product_variant_id_key" ON "stock_alerts"("user_id", "product_variant_id");
CREATE INDEX "stock_alerts_product_variant_id_idx" ON "stock_alerts"("product_variant_id");

ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
