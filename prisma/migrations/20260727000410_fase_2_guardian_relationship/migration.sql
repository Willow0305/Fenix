-- A relação declarada acompanha a autorização para que a conversão de uma
-- inscrição de menor preserve o vínculo informado, sem inferir regra familiar.
ALTER TABLE "guardian_authorizations"
ADD COLUMN "relationship" VARCHAR(80) NOT NULL;

ALTER TABLE "guardian_authorizations"
ADD CONSTRAINT "guardian_authorizations_relationship_not_blank"
CHECK (length(btrim("relationship")) > 0);
