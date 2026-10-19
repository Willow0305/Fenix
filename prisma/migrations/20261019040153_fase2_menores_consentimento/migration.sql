-- AlterTable
ALTER TABLE "athletes" ADD COLUMN     "guardian_acknowledged_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "interested_people" ADD COLUMN     "guardian_name" VARCHAR(160),
ADD COLUMN     "guardian_phone" VARCHAR(30);

-- AlterTable
ALTER TABLE "tryout_registrations" ADD COLUMN     "consent_at" TIMESTAMPTZ(6),
ADD COLUMN     "guardian_name" VARCHAR(160),
ADD COLUMN     "guardian_phone" VARCHAR(30),
ADD COLUMN     "privacy_notice_version" VARCHAR(40);
