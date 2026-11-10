-- "Quero jogar no Fênix" recebendo contatos (DT-107): fechado quando o elenco está lotado.
ALTER TABLE "team_settings" ADD COLUMN     "interest_intake_open" BOOLEAN NOT NULL DEFAULT true;

