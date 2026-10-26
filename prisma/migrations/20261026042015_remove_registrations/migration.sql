-- DT-046 (R-13): remove a tabela reservada `registrations`, nunca usada (DT-028).
-- Trava: se houver qualquer registro, a migração para sem apagar nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "registrations") THEN
    RAISE EXCEPTION 'registrations não está vazia; revise antes de remover (DT-046).';
  END IF;
END $$;

/*
  Aviso:

  - A tabela `registrations` será removida. Se ela não estiver vazia, os dados dela serão perdidos
    (a trava acima impede a remoção nesse caso).

*/
-- Remove chave estrangeira
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_applicant_user_id_fkey";

-- Remove chave estrangeira
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_interested_person_id_fkey";

-- Remove chave estrangeira
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_requested_team_id_fkey";

-- Remove chave estrangeira
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_resulting_athlete_id_fkey";

-- Remove chave estrangeira
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_reviewed_by_id_fkey";

-- Remove tabela
DROP TABLE "registrations";

-- Remove enum
DROP TYPE "RegistrationStatus";
