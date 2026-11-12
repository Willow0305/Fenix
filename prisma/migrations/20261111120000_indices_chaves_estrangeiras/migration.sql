-- Índices para chaves estrangeiras usadas em consultas (análise do sistema de 2026-11-11, DT-112).
-- CreateIndex
CREATE INDEX "financial_transactions_cash_closing_id_idx" ON "financial_transactions"("cash_closing_id");

-- CreateIndex
CREATE INDEX "forum_reactions_user_id_idx" ON "forum_reactions"("user_id");

-- CreateIndex
CREATE INDEX "news_category_id_idx" ON "news"("category_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "product_reviews_user_id_idx" ON "product_reviews"("user_id");

