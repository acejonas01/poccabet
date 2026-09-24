-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "home" TEXT NOT NULL,
    "away" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "homeLogo" TEXT NOT NULL DEFAULT '',
    "awayLogo" TEXT NOT NULL DEFAULT '',
    "kickoff" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pick_day_deviceId_matchId_key" ON "Pick"("day", "deviceId", "matchId");

-- CreateIndex
CREATE INDEX "Pick_day_idx" ON "Pick"("day");
