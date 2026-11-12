-- Tempo real para o dono (DT-116, onda 3). Além do assunto, a mudança avisa a quem ela
-- pertence: a pessoa (pedido, mensalidade, carteirinha, inscrição, agendamento, solicitação
-- LGPD) e, nos pedidos, o próprio pedido, para quem acompanha pelo link sem conta (pedido
-- sem login e entregador). O aviso leva só o assunto e o identificador, nunca dados.

-- Donos de um registro: a pessoa ligada a ele e, no pedido, o próprio pedido.
CREATE FUNCTION fenix_owners_of(kind text, ref uuid) RETURNS SETOF uuid AS $$
BEGIN
  IF ref IS NULL THEN
    RETURN;
  END IF;

  IF kind = 'user' THEN
    RETURN NEXT ref;
  ELSIF kind = 'athlete' THEN
    RETURN QUERY SELECT a.user_id FROM athletes a WHERE a.id = ref AND a.user_id IS NOT NULL;
  ELSIF kind = 'fee' THEN
    RETURN QUERY
      SELECT a.user_id FROM monthly_fees f JOIN athletes a ON a.id = f.athlete_id
      WHERE f.id = ref AND a.user_id IS NOT NULL;
  ELSIF kind = 'order' THEN
    RETURN NEXT ref;
    RETURN QUERY
      SELECT o.customer_user_id FROM orders o
      WHERE o.id = ref AND o.customer_user_id IS NOT NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Argumentos: assuntos separados por vírgula, tipo do dono e coluna que aponta para ele.
CREATE FUNCTION fenix_notify_owner() RETURNS trigger AS $$
DECLARE
  topics text[] := string_to_array(TG_ARGV[0], ',');
  refs uuid[] := ARRAY[]::uuid[];
  ref uuid;
  owner uuid;
  topic text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    refs := refs || (to_jsonb(OLD) ->> TG_ARGV[2])::uuid;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    refs := refs || (to_jsonb(NEW) ->> TG_ARGV[2])::uuid;
  END IF;

  FOREACH ref IN ARRAY refs LOOP
    FOR owner IN SELECT DISTINCT o FROM fenix_owners_of(TG_ARGV[1], ref) AS o LOOP
      FOREACH topic IN ARRAY topics LOOP
        PERFORM pg_notify('fenix_changes', topic || ':' || owner::text);
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fenix_rt_owner_users AFTER UPDATE ON "users"
  FOR EACH ROW
  WHEN (
    (to_jsonb(OLD) - ARRAY['last_login_at', 'mfa_last_used_step', 'updated_at'])
      IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['last_login_at', 'mfa_last_used_step', 'updated_at'])
  )
  EXECUTE FUNCTION fenix_notify_owner('users', 'user', 'id');

CREATE TRIGGER fenix_rt_owner_user_roles AFTER INSERT OR UPDATE OR DELETE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('users', 'user', 'user_id');

CREATE TRIGGER fenix_rt_owner_athletes AFTER INSERT OR UPDATE OR DELETE ON "athletes"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('athletes', 'user', 'user_id');

CREATE TRIGGER fenix_rt_owner_team_athletes AFTER INSERT OR UPDATE OR DELETE ON "team_athletes"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('athletes', 'athlete', 'athlete_id');

CREATE TRIGGER fenix_rt_owner_athlete_monthly_fee_plans AFTER INSERT OR UPDATE OR DELETE ON "athlete_monthly_fee_plans"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('fees', 'athlete', 'athlete_id');

CREATE TRIGGER fenix_rt_owner_monthly_fees AFTER INSERT OR UPDATE OR DELETE ON "monthly_fees"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('fees', 'athlete', 'athlete_id');

CREATE TRIGGER fenix_rt_owner_monthly_fee_payments AFTER INSERT OR UPDATE OR DELETE ON "monthly_fee_payments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('fees,payments', 'fee', 'monthly_fee_id');

CREATE TRIGGER fenix_rt_owner_orders AFTER INSERT OR UPDATE OR DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('orders', 'order', 'id');

CREATE TRIGGER fenix_rt_owner_order_items AFTER INSERT OR UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('orders', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_return_requests AFTER INSERT OR UPDATE OR DELETE ON "return_requests"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('orders', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_delivery_attempts AFTER INSERT OR UPDATE OR DELETE ON "delivery_attempts"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('orders,delivery', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_guest_order_messages AFTER INSERT OR UPDATE OR DELETE ON "guest_order_messages"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('orders', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_payments AFTER INSERT OR UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('payments', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_refunds AFTER INSERT OR UPDATE OR DELETE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('payments', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_card_charges AFTER INSERT OR UPDATE OR DELETE ON "card_charges"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('payments', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_pix_charges AFTER INSERT OR UPDATE OR DELETE ON "pix_charges"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('payments', 'order', 'order_id');

CREATE TRIGGER fenix_rt_owner_pix_charges_2 AFTER INSERT OR UPDATE OR DELETE ON "pix_charges"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('payments', 'fee', 'monthly_fee_id');

CREATE TRIGGER fenix_rt_owner_member_cards AFTER INSERT OR UPDATE OR DELETE ON "member_cards"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('cards', 'user', 'holder_user_id');

CREATE TRIGGER fenix_rt_owner_member_cards_2 AFTER INSERT OR UPDATE OR DELETE ON "member_cards"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('cards', 'user', 'purchased_by_user_id');

CREATE TRIGGER fenix_rt_owner_tryout_registrations AFTER INSERT OR UPDATE OR DELETE ON "tryout_registrations"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('registrations', 'user', 'applicant_user_id');

CREATE TRIGGER fenix_rt_owner_appointments AFTER INSERT OR UPDATE OR DELETE ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('appointments', 'user', 'requester_user_id');

CREATE TRIGGER fenix_rt_owner_privacy_requests AFTER INSERT OR UPDATE OR DELETE ON "privacy_requests"
  FOR EACH ROW EXECUTE FUNCTION fenix_notify_owner('privacy', 'user', 'user_id');
