-- Forma de pagamento escolhida no checkout (DT-076).

-- CreateEnum
CREATE TYPE "OrderPaymentChoice" AS ENUM ('PIX', 'CARD');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_choice" "OrderPaymentChoice" NOT NULL DEFAULT 'PIX';

