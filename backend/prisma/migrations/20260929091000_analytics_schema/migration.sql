-- Analytics-ready schema: sports catalog (leagues, events, markets, selections) linked from bet legs,
-- wallet/user fields, login history. Then: backfill existing data, and reporting views (v_*).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "signup_source" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "locked_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "balance_before" INTEGER,
ADD COLUMN     "bet_id" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "away_score" INTEGER,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "home_score" INTEGER,
ADD COLUMN     "ht_away_score" INTEGER,
ADD COLUMN     "ht_home_score" INTEGER,
ADD COLUMN     "league_id" TEXT,
ADD COLUMN     "result" TEXT,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "code" TEXT,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "selections" ADD COLUMN     "code" TEXT,
ADD COLUMN     "result" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "bet_legs" ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "market_id" TEXT,
ADD COLUMN     "settled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "sport_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_slug_key" ON "leagues"("slug");

-- CreateIndex
CREATE INDEX "login_events_created_at_idx" ON "login_events"("created_at");

-- CreateIndex
CREATE INDEX "login_events_user_id_created_at_idx" ON "login_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_bet_id_idx" ON "wallet_transactions"("bet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_created_at_idx" ON "wallet_transactions"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_external_id_key" ON "events"("external_id");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "events_league_id_idx" ON "events"("league_id");

-- CreateIndex
CREATE UNIQUE INDEX "markets_event_id_code_key" ON "markets"("event_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "selections_market_id_code_key" ON "selections"("market_id", "code");

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- CreateIndex
CREATE INDEX "bets_placed_at_idx" ON "bets"("placed_at");

-- CreateIndex
CREATE INDEX "bet_legs_event_id_idx" ON "bet_legs"("event_id");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================================
-- Backfill: build the catalog from the bets already placed, and link every leg to it.
-- ============================================================================================
INSERT INTO sports (id, name, slug)
SELECT 'sport_football', 'Football', 'football'
WHERE NOT EXISTS (SELECT 1 FROM sports WHERE slug = 'football');

INSERT INTO leagues (id, sport_id, name, country, slug)
SELECT 'lg_' || md5(x.slug), (SELECT id FROM sports WHERE slug = 'football'), x.name, x.country, x.slug
FROM (
  SELECT DISTINCT ON (slug) league AS name, country,
         trim(both '-' from regexp_replace(lower(country || ' ' || league), '[^a-z0-9]+', '-', 'g')) AS slug
  FROM bet_legs WHERE match_id <> '' AND league <> ''
  ORDER BY slug
) x
ON CONFLICT (slug) DO NOTHING;

INSERT INTO events (id, sport_id, league, home_team, away_team, start_time, status, external_id, league_id, country)
SELECT 'ev_' || md5(l.match_id), s.id, l.league, l.home, l.away, coalesce(l.kickoff, now() AT TIME ZONE 'UTC'),
       CASE WHEN p.pending THEN 'SCHEDULED' ELSE 'FINISHED' END, l.match_id, lg.id, l.country
FROM (
  SELECT DISTINCT ON (match_id) match_id, league, home, away, kickoff, country
  FROM bet_legs WHERE match_id <> ''
  ORDER BY match_id, kickoff DESC NULLS LAST
) l
JOIN (SELECT match_id, bool_or(result = 'PENDING') AS pending FROM bet_legs WHERE match_id <> '' GROUP BY match_id) p USING (match_id)
LEFT JOIN leagues lg ON lg.slug = trim(both '-' from regexp_replace(lower(l.country || ' ' || l.league), '[^a-z0-9]+', '-', 'g'))
CROSS JOIN (SELECT id FROM sports WHERE slug = 'football') s
ON CONFLICT (external_id) DO NOTHING;

INSERT INTO markets (id, event_id, type, name, code, status)
SELECT 'mk_' || md5(e.id || '|' || x.market), e.id, upper(x.market), coalesce(nullif(x.label, ''), x.market), x.market,
       CASE WHEN x.pending THEN 'OPEN' ELSE 'SETTLED' END
FROM (
  SELECT match_id, market, max(market_label) AS label, bool_or(result = 'PENDING') AS pending
  FROM bet_legs WHERE match_id <> '' AND market <> '' GROUP BY 1, 2
) x
JOIN events e ON e.external_id = x.match_id
ON CONFLICT (event_id, code) DO NOTHING;

INSERT INTO selections (id, market_id, label, odds, code, status, result)
SELECT 'sl_' || md5(m.id || '|' || x.selection), m.id, x.selection, x.odds, x.selection,
       CASE WHEN x.pending THEN 'OPEN' ELSE 'SETTLED' END, x.result
FROM (
  SELECT l.match_id, l.market, l.selection,
         (array_agg(l.odds ORDER BY b.placed_at DESC))[1] AS odds,
         bool_or(l.result = 'PENDING') AS pending,
         CASE WHEN bool_or(l.result = 'PENDING') THEN NULL ELSE max(l.result) END AS result
  FROM bet_legs l JOIN bets b ON b.id = l.bet_id
  WHERE l.match_id <> '' AND l.market <> '' AND l.selection <> ''
  GROUP BY 1, 2, 3
) x
JOIN events e ON e.external_id = x.match_id
JOIN markets m ON m.event_id = e.id AND m.code = x.market
ON CONFLICT (market_id, code) DO NOTHING;

UPDATE bet_legs l SET event_id = e.id FROM events e WHERE e.external_id = l.match_id AND l.event_id IS NULL;
UPDATE bet_legs l SET market_id = m.id FROM markets m WHERE m.event_id = l.event_id AND m.code = l.market AND l.market_id IS NULL;
UPDATE bet_legs l SET selection_id = s.id FROM selections s WHERE s.market_id = l.market_id AND s.code = l.selection AND l.selection_id IS NULL;
UPDATE bet_legs l SET settled_at = b.settled_at FROM bets b WHERE b.id = l.bet_id AND l.result <> 'PENDING' AND l.settled_at IS NULL;

UPDATE wallet_transactions SET balance_before = balance_after - amount WHERE balance_before IS NULL AND balance_after IS NOT NULL;
UPDATE wallet_transactions t SET bet_id = b.id FROM bets b
WHERE t.bet_id IS NULL AND t.type IN ('BET_STAKE', 'BET_PAYOUT', 'BET_REFUND') AND t.reference = b.id;

-- ============================================================================================
-- Reporting views. Money in naira (_ngn); days are Lagos days (UTC+1). Point Metabase, Looker
-- Studio, Excel… at these. Note: a column a view uses can't be dropped until the view is changed.
-- ============================================================================================
-- Kobo → naira, rounded to 2 decimals.
CREATE OR REPLACE FUNCTION ngn(kobo numeric) RETURNS numeric AS $$ SELECT round($1 / 100.0, 2) $$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE VIEW v_users AS
SELECT u.id, u.display_name, u.role,
       CASE WHEN u.deleted_at IS NOT NULL THEN 'DELETED' WHEN u.suspended_at IS NOT NULL THEN 'SUSPENDED' ELSE 'ACTIVE' END AS status,
       u.signup_source, u.referral_code, u.created_at, (u.created_at + interval '1 hour')::date AS signup_day,
       u.last_login_at, u.email_verified_at IS NOT NULL AS email_verified, u.phone_verified_at IS NOT NULL AS phone_verified,
       u.bonus_claimed_at IS NOT NULL AS bonus_claimed, ngn(coalesce(w.balance, 0)) AS balance_ngn
FROM users u LEFT JOIN wallets w ON w.user_id = u.id;

CREATE OR REPLACE VIEW v_bets AS
SELECT b.id, b.ticket, b.user_id, b.type, b.status, b.source,
       (SELECT count(*) FROM bet_legs l WHERE l.bet_id = b.id) AS legs,
       ngn(b.stake) AS stake_ngn, b.total_odds, ngn(b.potential_payout) AS potential_payout_ngn,
       ngn(b.payout) AS payout_ngn,
       CASE WHEN b.status IN ('WON', 'LOST', 'VOID') THEN ngn(b.stake - coalesce(b.payout, 0)) END AS ggr_ngn,
       b.placed_at, (b.placed_at + interval '1 hour')::date AS placed_day,
       b.settled_at, (b.settled_at + interval '1 hour')::date AS settled_day
FROM bets b;

CREATE OR REPLACE VIEW v_bet_legs AS
SELECT l.id, l.bet_id, b.ticket, b.user_id, b.type AS bet_type, b.status AS bet_status,
       (b.placed_at + interval '1 hour')::date AS placed_day,
       l.event_id, l.match_id, l.home, l.away, l.league, l.country, e.league_id,
       l.market, l.market_label, l.selection, l.odds, l.result, l.kickoff, l.settled_at,
       e.status AS event_status, e.home_score, e.away_score, e.result AS event_result
FROM bet_legs l JOIN bets b ON b.id = l.bet_id LEFT JOIN events e ON e.id = l.event_id;

CREATE OR REPLACE VIEW v_daily_kpis AS
WITH days AS (
  -- Stored times are UTC without a zone; compare with "now" in UTC whatever the server's time zone.
  SELECT generate_series(
    (least(coalesce((SELECT min(created_at) FROM users), now() AT TIME ZONE 'UTC'), coalesce((SELECT min(placed_at) FROM bets), now() AT TIME ZONE 'UTC')) + interval '1 hour')::date,
    ((now() AT TIME ZONE 'UTC') + interval '1 hour')::date, interval '1 day')::date AS day
),
signups AS (SELECT (created_at + interval '1 hour')::date AS day, count(*) AS n FROM users GROUP BY 1),
logins AS (SELECT (created_at + interval '1 hour')::date AS day, count(DISTINCT user_id) AS n FROM login_events GROUP BY 1),
placed AS (SELECT (placed_at + interval '1 hour')::date AS day, count(*) AS bets, count(DISTINCT user_id) AS bettors, sum(stake) AS stake FROM bets GROUP BY 1),
settled AS (SELECT (settled_at + interval '1 hour')::date AS day, count(*) AS bets, sum(stake) AS stake, sum(coalesce(payout, 0)) AS payout
            FROM bets WHERE status IN ('WON', 'LOST', 'VOID') AND settled_at IS NOT NULL GROUP BY 1),
money AS (SELECT (created_at + interval '1 hour')::date AS day,
                 sum(CASE WHEN type = 'BONUS' THEN amount ELSE 0 END) AS bonuses,
                 sum(CASE WHEN type = 'DEPOSIT' AND status = 'COMPLETED' THEN amount ELSE 0 END) AS deposits,
                 sum(CASE WHEN type = 'WITHDRAWAL' AND status = 'COMPLETED' THEN -amount ELSE 0 END) AS withdrawals
          FROM wallet_transactions GROUP BY 1)
SELECT d.day,
       coalesce(su.n, 0) AS signups, coalesce(li.n, 0) AS active_logins, coalesce(p.bettors, 0) AS active_bettors,
       coalesce(p.bets, 0) AS bets_placed, ngn(coalesce(p.stake, 0)) AS stake_ngn,
       coalesce(st.bets, 0) AS bets_settled, ngn(coalesce(st.payout, 0)) AS payouts_ngn,
       ngn(coalesce(st.stake, 0) - coalesce(st.payout, 0)) AS ggr_ngn,
       ngn(coalesce(m.bonuses, 0)) AS bonuses_ngn, ngn(coalesce(m.deposits, 0)) AS deposits_ngn, ngn(coalesce(m.withdrawals, 0)) AS withdrawals_ngn
FROM days d
LEFT JOIN signups su ON su.day = d.day LEFT JOIN logins li ON li.day = d.day LEFT JOIN placed p ON p.day = d.day
LEFT JOIN settled st ON st.day = d.day LEFT JOIN money m ON m.day = d.day;

-- A multiple's stake and payout are split evenly across its legs, so leagues and markets add up to the total.
CREATE OR REPLACE VIEW v_ggr_by_league AS
SELECT l.country, l.league, e.league_id, count(DISTINCT b.id) AS bets, count(*) AS legs,
       ngn(sum(b.stake::numeric / n.legs)) AS stake_ngn,
       ngn(sum(coalesce(b.payout, 0)::numeric / n.legs)) AS payouts_ngn,
       ngn(sum((b.stake - coalesce(b.payout, 0))::numeric / n.legs)) AS ggr_ngn
FROM bet_legs l JOIN bets b ON b.id = l.bet_id LEFT JOIN events e ON e.id = l.event_id
JOIN (SELECT bet_id, count(*) AS legs FROM bet_legs GROUP BY bet_id) n ON n.bet_id = b.id
WHERE b.status IN ('WON', 'LOST', 'VOID')
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW v_ggr_by_market AS
SELECT l.market, max(l.market_label) AS market_label, count(DISTINCT b.id) AS bets, count(*) AS legs,
       ngn(sum(b.stake::numeric / n.legs)) AS stake_ngn,
       ngn(sum(coalesce(b.payout, 0)::numeric / n.legs)) AS payouts_ngn,
       ngn(sum((b.stake - coalesce(b.payout, 0))::numeric / n.legs)) AS ggr_ngn
FROM bet_legs l JOIN bets b ON b.id = l.bet_id
JOIN (SELECT bet_id, count(*) AS legs FROM bet_legs GROUP BY bet_id) n ON n.bet_id = b.id
WHERE b.status IN ('WON', 'LOST', 'VOID')
GROUP BY 1;

CREATE OR REPLACE VIEW v_player_value AS
SELECT u.id AS user_id, u.display_name, u.created_at AS signed_up_at, u.signup_source,
       min(b.placed_at) AS first_bet_at, max(b.placed_at) AS last_bet_at,
       count(b.id) AS bets, count(DISTINCT (b.placed_at + interval '1 hour')::date) AS days_active,
       ngn(coalesce(sum(b.stake), 0)) AS stake_ngn,
       ngn(coalesce(sum(b.payout), 0)) AS payouts_ngn,
       ngn(coalesce(sum(CASE WHEN b.status IN ('WON', 'LOST', 'VOID') THEN b.stake - coalesce(b.payout, 0) END), 0)) AS ggr_ngn,
       ngn(coalesce((SELECT sum(t.amount) FROM wallet_transactions t JOIN wallets w2 ON w2.id = t.wallet_id WHERE w2.user_id = u.id AND t.type = 'BONUS'), 0)) AS bonuses_ngn,
       ngn(coalesce(w.balance, 0)) AS balance_ngn
FROM users u LEFT JOIN bets b ON b.user_id = u.id LEFT JOIN wallets w ON w.user_id = u.id
GROUP BY u.id, w.balance;
