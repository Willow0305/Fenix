-- DT-040: telefones passam a ser gravados só com dígitos (DDD + número, 10 ou 11 dígitos).
-- Remove máscara e o prefixo +55; valores que não resultam em 10 ou 11 dígitos ficam
-- como estão, para revisão manual (nenhum dado é apagado).
CREATE FUNCTION pg_temp.br_phone(value text) RETURNS text AS $$
DECLARE
  digits text := regexp_replace(coalesce(value, ''), '\D', '', 'g');
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;
  IF length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN
    digits := substr(digits, 3);
  END IF;
  IF length(digits) IN (10, 11) THEN
    RETURN digits;
  END IF;
  RETURN value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "users" SET "phone" = pg_temp.br_phone("phone") WHERE "phone" IS NOT NULL;
UPDATE "team_settings" SET "phone" = pg_temp.br_phone("phone") WHERE "phone" IS NOT NULL;
UPDATE "athletes" SET
  "phone" = pg_temp.br_phone("phone"),
  "emergency_contact_phone" = pg_temp.br_phone("emergency_contact_phone"),
  "guardian_phone" = pg_temp.br_phone("guardian_phone");
UPDATE "interested_people" SET
  "phone" = pg_temp.br_phone("phone"),
  "guardian_phone" = pg_temp.br_phone("guardian_phone");
UPDATE "registrations" SET "phone" = pg_temp.br_phone("phone") WHERE "phone" IS NOT NULL;
UPDATE "tryout_registrations" SET
  "phone" = pg_temp.br_phone("phone"),
  "guardian_phone" = pg_temp.br_phone("guardian_phone");
UPDATE "orders" SET "customer_phone" = pg_temp.br_phone("customer_phone") WHERE "customer_phone" IS NOT NULL;
UPDATE "partners" SET "phone" = pg_temp.br_phone("phone") WHERE "phone" IS NOT NULL;
UPDATE "partner_professionals" SET "phone" = pg_temp.br_phone("phone") WHERE "phone" IS NOT NULL;
