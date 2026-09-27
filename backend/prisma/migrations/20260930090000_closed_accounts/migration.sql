-- Sealed identity archive for deleted accounts, and the visitor IP on login events.
-- closed_accounts holds personal data: deliberately NOT granted to analytics_reader.
-- AlterTable
ALTER TABLE "login_events" ADD COLUMN     "ip" TEXT;

-- CreateTable
CREATE TABLE "closed_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" TEXT NOT NULL,
    "closed_by_admin" TEXT,
    "reason" TEXT,
    "retain_until" TIMESTAMP(3) NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "date_of_birth" DATE,
    "phone" TEXT,
    "phone_verified_at" TIMESTAMP(3),
    "email" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "age_confirmed_at" TIMESTAMP(3),
    "referral_code" TEXT,
    "signup_source" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL,
    "suspended_at" TIMESTAMP(3),
    "suspended_reason" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "last_user_agent" TEXT,
    "signup_ip" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "deposits" INTEGER NOT NULL DEFAULT 0,
    "withdrawals" INTEGER NOT NULL DEFAULT 0,
    "bonuses" INTEGER NOT NULL DEFAULT 0,
    "staked" INTEGER NOT NULL DEFAULT 0,
    "paid_out" INTEGER NOT NULL DEFAULT 0,
    "bets" INTEGER NOT NULL DEFAULT 0,
    "open_bets" INTEGER NOT NULL DEFAULT 0,
    "first_bet_at" TIMESTAMP(3),
    "last_bet_at" TIMESTAMP(3),

    CONSTRAINT "closed_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closed_accounts_user_id_key" ON "closed_accounts"("user_id");

-- CreateIndex
CREATE INDEX "closed_accounts_retain_until_idx" ON "closed_accounts"("retain_until");

-- CreateIndex
CREATE INDEX "closed_accounts_phone_idx" ON "closed_accounts"("phone");

-- CreateIndex
CREATE INDEX "closed_accounts_email_idx" ON "closed_accounts"("email");

-- AddForeignKey
ALTER TABLE "closed_accounts" ADD CONSTRAINT "closed_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

