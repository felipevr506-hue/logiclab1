BEGIN;
SET LOCAL lock_timeout = '5s';

-- Abort instead of merging or deleting accounts if historical emails conflict.
LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "User" GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Equivalent emails exist. Resolve explicitly before applying this migration.';
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN "username" TEXT;
-- Reserved names contain no email/name data and preserve every existing user ID.
WITH existing AS (
  SELECT id, 'legacy_' || row_number() OVER (ORDER BY id)::text AS username FROM "User"
)
UPDATE "User" AS u SET username = e.username FROM existing AS e WHERE u.id = e.id;
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "User" ADD CONSTRAINT "User_username_format_check"
  CHECK (username = lower(username) AND username ~ '^[a-z][a-z0-9_]{2,31}$');

UPDATE "User" SET email = lower(btrim(email));
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check" CHECK (email = lower(btrim(email)));
COMMIT;
