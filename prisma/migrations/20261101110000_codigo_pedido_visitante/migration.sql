-- Código do pedido sem conta cifrado: link fixo e reenvio (DT-096).
ALTER TABLE "orders" ADD COLUMN "guest_access_code_encrypted" TEXT;
