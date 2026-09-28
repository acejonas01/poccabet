-- Booking codes: the same selections always get the same code. "signature" is a hash of the slip's
-- selections (match, market, pick; order doesn't matter). Older codes have none.
ALTER TABLE "booked_slips" ADD COLUMN "signature" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "booked_slips_signature_key" ON "booked_slips"("signature");
