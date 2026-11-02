-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable: eksisterende «Jeg har betalt» er ikke sjekket, så de venter på godkjenning.
ALTER TABLE "PaymentConfirmation" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'pending';
