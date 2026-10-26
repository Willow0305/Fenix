-- DT-048: avisos por e-mail e WhatsApp, com preferências por finalidade e consentimento
-- para WhatsApp. O destino não é copiado para a fila; é lido da conta na hora do envio.

-- Cria enum
CREATE TYPE "NotificationCategory" AS ENUM ('FINANCE', 'STORE', 'SPORTS', 'AGENDA', 'ANNOUNCEMENTS', 'COMMUNITY', 'ACCOUNT');

-- Altera enum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- Altera enum
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE 'SENDING';

-- Altera tabela
ALTER TABLE "users" ADD COLUMN     "whatsapp_opt_in_at" TIMESTAMPTZ(6);

-- Cria tabela
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(100),
    "provider_message_id" VARCHAR(160),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- Cria tabela
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Cria índice
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- Cria índice
CREATE INDEX "notification_deliveries_channel_status_created_at_idx" ON "notification_deliveries"("channel", "status", "created_at");

-- Cria índice
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- Cria índice
CREATE UNIQUE INDEX "notification_preferences_user_id_category_channel_key" ON "notification_preferences"("user_id", "category", "channel");

-- Adiciona chave estrangeira
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adiciona chave estrangeira
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Canal externo só (o aviso no painel é a própria notificação) e tentativas não negativas.
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_check" CHECK ("channel" <> 'IN_APP');
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_attempts_check" CHECK ("attempts" >= 0);
