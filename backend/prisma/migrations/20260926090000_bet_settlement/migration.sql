-- Bet settlement (phase 2): what each settled bet actually paid, and a fast "still pending" lookup.
ALTER TABLE "Bet" ADD COLUMN "payout" INTEGER;
CREATE INDEX "BetSelection_result_kickoff_idx" ON "BetSelection"("result", "kickoff");
