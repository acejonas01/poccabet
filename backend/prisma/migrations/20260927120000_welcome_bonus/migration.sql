-- Welcome bonus: one claim per account, after email verification.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bonusClaimedAt" TIMESTAMP(3);
