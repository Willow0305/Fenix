-- Avisos do pedido para quem compra sem conta, por e-mail e WhatsApp (DT-096).

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "guest_whatsapp_opt_in_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "guest_order_messages" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "kind" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(100),
    "provider_message_id" VARCHAR(160),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guest_order_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_order_messages_status_next_attempt_at_idx" ON "guest_order_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_order_messages_order_id_kind_channel_key" ON "guest_order_messages"("order_id", "kind", "channel");

-- AddForeignKey
ALTER TABLE "guest_order_messages" ADD CONSTRAINT "guest_order_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

