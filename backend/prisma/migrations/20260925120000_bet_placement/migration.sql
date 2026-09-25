-- Bet placement (phase 1): money in kobo, bets that record what was bet on, tickets, booking codes.

-- Money: naira (float) -> kobo (integer). Existing amounts are converted, not truncated.
ALTER TABLE "Wallet" ALTER COLUMN "balance" DROP DEFAULT;
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DATA TYPE INTEGER USING ROUND("balance" * 100)::INTEGER;
ALTER TABLE "Wallet" ALTER COLUMN "balance" SET DEFAULT 0;

ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "balanceAfter" INTEGER,
ADD COLUMN "reference" TEXT;

ALTER TABLE "Bet" ALTER COLUMN "stake" SET DATA TYPE INTEGER USING ROUND("stake" * 100)::INTEGER;
ALTER TABLE "Bet" ALTER COLUMN "potentialPayout" SET DATA TYPE INTEGER USING ROUND("potentialPayout" * 100)::INTEGER;

-- Bets: public ticket code (existing bets get one from their id), total odds, feed source, idempotency key.
ALTER TABLE "Bet" ADD COLUMN "ticket" TEXT,
ADD COLUMN "totalOdds" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Bet" SET "ticket" = 'PB' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 6)) WHERE "ticket" IS NULL;
ALTER TABLE "Bet" ALTER COLUMN "ticket" SET NOT NULL;

-- Selections: a copy of the match and pick; the old database outcome link becomes optional.
ALTER TABLE "BetSelection" DROP CONSTRAINT "BetSelection_outcomeId_fkey";
ALTER TABLE "BetSelection" ALTER COLUMN "outcomeId" DROP NOT NULL;
ALTER TABLE "BetSelection" ADD COLUMN "matchId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "home" TEXT NOT NULL DEFAULT '',
ADD COLUMN "away" TEXT NOT NULL DEFAULT '',
ADD COLUMN "league" TEXT NOT NULL DEFAULT '',
ADD COLUMN "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN "kickoff" TIMESTAMP(3),
ADD COLUMN "market" TEXT NOT NULL DEFAULT '',
ADD COLUMN "marketLabel" TEXT NOT NULL DEFAULT '',
ADD COLUMN "selection" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BetSelection" ADD CONSTRAINT "BetSelection_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Booking codes.
CREATE TABLE "BookedSlip" (
    "code" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookedSlip_pkey" PRIMARY KEY ("code")
);

-- Indexes.
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");
CREATE UNIQUE INDEX "Bet_ticket_key" ON "Bet"("ticket");
CREATE INDEX "Bet_userId_createdAt_idx" ON "Bet"("userId", "createdAt");
CREATE UNIQUE INDEX "Bet_userId_idempotencyKey_key" ON "Bet"("userId", "idempotencyKey");
CREATE INDEX "BetSelection_matchId_idx" ON "BetSelection"("matchId");
