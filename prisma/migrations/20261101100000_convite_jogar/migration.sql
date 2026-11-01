-- Convite "Quer jogar com a gente?" pode ser desligado pela diretoria (DT-091).
ALTER TABLE "team_settings" ADD COLUMN "join_invite_enabled" BOOLEAN NOT NULL DEFAULT true;
