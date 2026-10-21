BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "Attempt" ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "evaluationStatus" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "officialResult" JSONB;
CREATE UNIQUE INDEX "Attempt_userId_idempotencyKey_key" ON "Attempt"("userId", "idempotencyKey");
ALTER TABLE "UserProgress" ADD COLUMN "authoritativeState" JSONB,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
COMMIT;
