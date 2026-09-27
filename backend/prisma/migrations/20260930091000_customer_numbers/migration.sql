-- A short public customer number for every player (support calls, legal records), e.g. PC-4829135.
-- Random 7 digits so it doesn't reveal how many players there are. The internal id stays as it is.
CREATE OR REPLACE FUNCTION generate_customer_no() RETURNS text LANGUAGE plpgsql AS $$
DECLARE c text;
BEGIN
  LOOP
    c := 'PC-' || (1000000 + floor(random() * 9000000))::int;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE customer_no = c);
  END LOOP;
  RETURN c;
END $$;

ALTER TABLE "users" ADD COLUMN "customer_no" TEXT;
UPDATE "users" SET "customer_no" = generate_customer_no() WHERE "customer_no" IS NULL;
ALTER TABLE "users" ALTER COLUMN "customer_no" SET DEFAULT generate_customer_no();
ALTER TABLE "users" ALTER COLUMN "customer_no" SET NOT NULL;
CREATE UNIQUE INDEX "users_customer_no_key" ON "users"("customer_no");
