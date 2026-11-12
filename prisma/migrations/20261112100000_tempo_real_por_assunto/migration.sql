-- Tempo real por assunto (DT-116). Toda escrita nas tabelas abaixo avisa, no commit, o
-- assunto que mudou, venha de uma tela, de um webhook de pagamento ou de uma tarefa automática.
-- O aviso leva só o nome do assunto, nunca dados; avisos iguais na mesma transação viram um só
-- (garantia do NOTIFY). Quem pode receber cada assunto é decidido na API, pelas permissões.
-- Ficam de fora tabelas de sessão, carrinho, contadores e filas, que não aparecem em telas.

CREATE FUNCTION fenix_notify_topic() RETURNS trigger AS $$
DECLARE
  topic text;
BEGIN
  FOREACH topic IN ARRAY TG_ARGV LOOP
    PERFORM pg_notify('fenix_changes', topic);
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Login e uso da sessão (último acesso, passo do MFA) não mudam o que as telas mostram.
CREATE TRIGGER fenix_rt_users
  AFTER INSERT OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('users');

CREATE TRIGGER fenix_rt_users_update
  AFTER UPDATE ON "users"
  FOR EACH ROW
  WHEN (
    (to_jsonb(OLD) - ARRAY['last_login_at', 'mfa_last_used_step', 'updated_at'])
      IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['last_login_at', 'mfa_last_used_step', 'updated_at'])
  )
  EXECUTE FUNCTION fenix_notify_topic('users');

-- Pessoas, papéis e permissões
CREATE TRIGGER fenix_rt_user_roles AFTER INSERT OR UPDATE OR DELETE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('users');
CREATE TRIGGER fenix_rt_roles AFTER INSERT OR UPDATE OR DELETE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('users');
CREATE TRIGGER fenix_rt_role_permissions AFTER INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('users');

-- Atletas e equipes
CREATE TRIGGER fenix_rt_athletes AFTER INSERT OR UPDATE OR DELETE ON "athletes"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('athletes', 'teams');
CREATE TRIGGER fenix_rt_athlete_documents AFTER INSERT OR UPDATE OR DELETE ON "athlete_documents"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('athletes');
CREATE TRIGGER fenix_rt_categories AFTER INSERT OR UPDATE OR DELETE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('teams');
CREATE TRIGGER fenix_rt_teams AFTER INSERT OR UPDATE OR DELETE ON "teams"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('teams');
CREATE TRIGGER fenix_rt_team_athletes AFTER INSERT OR UPDATE OR DELETE ON "team_athletes"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('teams', 'athletes');

-- Interessados e seletivas
CREATE TRIGGER fenix_rt_interested_people AFTER INSERT OR UPDATE OR DELETE ON "interested_people"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('registrations');
CREATE TRIGGER fenix_rt_tryouts AFTER INSERT OR UPDATE OR DELETE ON "tryouts"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('tryouts');
CREATE TRIGGER fenix_rt_tryout_registrations AFTER INSERT OR UPDATE OR DELETE ON "tryout_registrations"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('registrations', 'tryouts');

-- Mensalidades
CREATE TRIGGER fenix_rt_monthly_fee_plans AFTER INSERT OR UPDATE OR DELETE ON "monthly_fee_plans"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('fees');
CREATE TRIGGER fenix_rt_athlete_monthly_fee_plans AFTER INSERT OR UPDATE OR DELETE ON "athlete_monthly_fee_plans"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('fees');
CREATE TRIGGER fenix_rt_monthly_fees AFTER INSERT OR UPDATE OR DELETE ON "monthly_fees"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('fees');
CREATE TRIGGER fenix_rt_monthly_fee_payments AFTER INSERT OR UPDATE OR DELETE ON "monthly_fee_payments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('fees', 'payments');

-- Pagamentos (PIX, cartão, manual) e estornos
CREATE TRIGGER fenix_rt_payments AFTER INSERT OR UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('payments');
CREATE TRIGGER fenix_rt_refunds AFTER INSERT OR UPDATE OR DELETE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('payments');
CREATE TRIGGER fenix_rt_pix_charges AFTER INSERT OR UPDATE OR DELETE ON "pix_charges"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('payments');
CREATE TRIGGER fenix_rt_card_charges AFTER INSERT OR UPDATE OR DELETE ON "card_charges"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('payments');
CREATE TRIGGER fenix_rt_payment_methods AFTER INSERT OR UPDATE OR DELETE ON "payment_methods"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('payments', 'finance');

-- Caixa
CREATE TRIGGER fenix_rt_financial_accounts AFTER INSERT OR UPDATE OR DELETE ON "financial_accounts"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_financial_categories AFTER INSERT OR UPDATE OR DELETE ON "financial_categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_cost_centers AFTER INSERT OR UPDATE OR DELETE ON "cost_centers"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_financial_obligations AFTER INSERT OR UPDATE OR DELETE ON "financial_obligations"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_financial_transactions AFTER INSERT OR UPDATE OR DELETE ON "financial_transactions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_financial_transfers AFTER INSERT OR UPDATE OR DELETE ON "financial_transfers"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_financial_transaction_attachments AFTER INSERT OR UPDATE OR DELETE ON "financial_transaction_attachments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');
CREATE TRIGGER fenix_rt_cash_closings AFTER INSERT OR UPDATE OR DELETE ON "cash_closings"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('finance');

-- Loja: catálogo, estoque e avaliações
CREATE TRIGGER fenix_rt_product_categories AFTER INSERT OR UPDATE OR DELETE ON "product_categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_products AFTER INSERT OR UPDATE OR DELETE ON "products"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_product_images AFTER INSERT OR UPDATE OR DELETE ON "product_images"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_product_variants AFTER INSERT OR UPDATE OR DELETE ON "product_variants"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_inventory_movements AFTER INSERT OR UPDATE OR DELETE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_product_personalization_fields AFTER INSERT OR UPDATE OR DELETE ON "product_personalization_fields"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');
CREATE TRIGGER fenix_rt_product_reviews AFTER INSERT OR UPDATE OR DELETE ON "product_reviews"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('store');

-- Cupons
CREATE TRIGGER fenix_rt_coupons AFTER INSERT OR UPDATE OR DELETE ON "coupons"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('coupons');
CREATE TRIGGER fenix_rt_coupon_products AFTER INSERT OR UPDATE OR DELETE ON "coupon_products"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('coupons');
CREATE TRIGGER fenix_rt_coupon_categories AFTER INSERT OR UPDATE OR DELETE ON "coupon_categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('coupons');
CREATE TRIGGER fenix_rt_coupon_roles AFTER INSERT OR UPDATE OR DELETE ON "coupon_roles"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('coupons');
CREATE TRIGGER fenix_rt_coupon_redemptions AFTER INSERT OR UPDATE OR DELETE ON "coupon_redemptions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('coupons');

-- Remessas
CREATE TRIGGER fenix_rt_sales_campaigns AFTER INSERT OR UPDATE OR DELETE ON "sales_campaigns"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('campaigns');
CREATE TRIGGER fenix_rt_sales_campaign_products AFTER INSERT OR UPDATE OR DELETE ON "sales_campaign_products"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('campaigns');

-- Pedidos, devoluções e entregas
CREATE TRIGGER fenix_rt_orders AFTER INSERT OR UPDATE OR DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders');
CREATE TRIGGER fenix_rt_order_items AFTER INSERT OR UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders');
CREATE TRIGGER fenix_rt_return_requests AFTER INSERT OR UPDATE OR DELETE ON "return_requests"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders');
CREATE TRIGGER fenix_rt_return_request_items AFTER INSERT OR UPDATE OR DELETE ON "return_request_items"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders');
CREATE TRIGGER fenix_rt_delivery_attempts AFTER INSERT OR UPDATE OR DELETE ON "delivery_attempts"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders', 'delivery');
CREATE TRIGGER fenix_rt_guest_order_messages AFTER INSERT OR UPDATE OR DELETE ON "guest_order_messages"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('orders');

-- Entrega em casa
CREATE TRIGGER fenix_rt_couriers AFTER INSERT OR UPDATE OR DELETE ON "couriers"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('delivery');
CREATE TRIGGER fenix_rt_delivery_zones AFTER INSERT OR UPDATE OR DELETE ON "delivery_zones"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('delivery', 'settings');
CREATE TRIGGER fenix_rt_delivery_neighborhoods AFTER INSERT OR UPDATE OR DELETE ON "delivery_neighborhoods"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('delivery', 'settings');

-- Carteirinhas e benefícios
CREATE TRIGGER fenix_rt_member_cards AFTER INSERT OR UPDATE OR DELETE ON "member_cards"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('cards');
CREATE TRIGGER fenix_rt_member_card_checks AFTER INSERT OR UPDATE OR DELETE ON "member_card_checks"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('cards');
CREATE TRIGGER fenix_rt_partner_benefits AFTER INSERT OR UPDATE OR DELETE ON "partner_benefits"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('benefits');

-- Parceiros, agenda e repasses
CREATE TRIGGER fenix_rt_partners AFTER INSERT OR UPDATE OR DELETE ON "partners"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('partners');
CREATE TRIGGER fenix_rt_partner_documents AFTER INSERT OR UPDATE OR DELETE ON "partner_documents"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('partners');
CREATE TRIGGER fenix_rt_partner_professionals AFTER INSERT OR UPDATE OR DELETE ON "partner_professionals"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('partners');
CREATE TRIGGER fenix_rt_partner_services AFTER INSERT OR UPDATE OR DELETE ON "partner_services"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('partners');
CREATE TRIGGER fenix_rt_professional_availabilities AFTER INSERT OR UPDATE OR DELETE ON "professional_availabilities"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('partners', 'appointments');
CREATE TRIGGER fenix_rt_appointments AFTER INSERT OR UPDATE OR DELETE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('appointments', 'partners');
CREATE TRIGGER fenix_rt_partner_settlements AFTER INSERT OR UPDATE OR DELETE ON "partner_settlements"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settlements');
CREATE TRIGGER fenix_rt_partner_settlement_items AFTER INSERT OR UPDATE OR DELETE ON "partner_settlement_items"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settlements');
CREATE TRIGGER fenix_rt_partner_settlement_recoveries AFTER INSERT OR UPDATE OR DELETE ON "partner_settlement_recoveries"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settlements');

-- Notícias, eventos e partidas
CREATE TRIGGER fenix_rt_news AFTER INSERT OR UPDATE OR DELETE ON "news"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('news');
CREATE TRIGGER fenix_rt_news_categories AFTER INSERT OR UPDATE OR DELETE ON "news_categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('news');
CREATE TRIGGER fenix_rt_news_images AFTER INSERT OR UPDATE OR DELETE ON "news_images"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('news');
CREATE TRIGGER fenix_rt_news_tags AFTER INSERT OR UPDATE OR DELETE ON "news_tags"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('news');
CREATE TRIGGER fenix_rt_news_tag_links AFTER INSERT OR UPDATE OR DELETE ON "news_tag_links"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('news');
CREATE TRIGGER fenix_rt_events AFTER INSERT OR UPDATE OR DELETE ON "events"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('events');
CREATE TRIGGER fenix_rt_matches AFTER INSERT OR UPDATE OR DELETE ON "matches"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('events', 'teams');
CREATE TRIGGER fenix_rt_external_matches AFTER INSERT OR UPDATE OR DELETE ON "external_matches"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('events', 'teams');

-- Fórum
CREATE TRIGGER fenix_rt_forum_categories AFTER INSERT OR UPDATE OR DELETE ON "forum_categories"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_topics AFTER INSERT OR UPDATE OR DELETE ON "forum_topics"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_posts AFTER INSERT OR UPDATE OR DELETE ON "forum_posts"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_reactions AFTER INSERT OR UPDATE OR DELETE ON "forum_reactions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_reports AFTER INSERT OR UPDATE OR DELETE ON "forum_reports"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_moderation_actions AFTER INSERT OR UPDATE OR DELETE ON "forum_moderation_actions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');
CREATE TRIGGER fenix_rt_forum_sanctions AFTER INSERT OR UPDATE OR DELETE ON "forum_sanctions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('forum');

-- Configurações e documentos públicos
CREATE TRIGGER fenix_rt_team_settings AFTER INSERT OR UPDATE OR DELETE ON "team_settings"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settings');
CREATE TRIGGER fenix_rt_club_photos AFTER INSERT OR UPDATE OR DELETE ON "club_photos"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settings');
CREATE TRIGGER fenix_rt_team_brand_assets AFTER INSERT OR UPDATE OR DELETE ON "team_brand_assets"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settings');
CREATE TRIGGER fenix_rt_legal_document_versions AFTER INSERT OR UPDATE OR DELETE ON "legal_document_versions"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('settings');
CREATE TRIGGER fenix_rt_accountability_reports AFTER INSERT OR UPDATE OR DELETE ON "accountability_reports"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('accountability');

-- LGPD, auditoria e notificações enviadas
CREATE TRIGGER fenix_rt_privacy_requests AFTER INSERT OR UPDATE OR DELETE ON "privacy_requests"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('privacy');
CREATE TRIGGER fenix_rt_audit_logs AFTER INSERT OR UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('audit');
CREATE TRIGGER fenix_rt_notifications AFTER INSERT OR UPDATE OR DELETE ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_topic('notifications');
