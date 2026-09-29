/*
  §3.5 + §3.6 — delivery state and snoozes.

  `NotificationLog` stops meaning "this was delivered" and starts meaning "this
  slot is being handled": `pending` (claimed or awaiting retry), `sent`, or
  `failed`. That is what makes a retry possible without risking a duplicate.

  Two things here are deliberate and are not what `prisma migrate dev` generates:

  1. `updatedAt` is added WITH a default and the default is then dropped. Prisma
     emits `NOT NULL` with no default, which fails outright on a table that
     already has rows — i.e. on every database in production.

  2. Existing rows are backfilled to `sent`. Every one of them has `sentAt`
     populated, meaning they really were delivered. Left as the `pending`
     default, the new retry pass would consider them all due and re-send every
     reminder the bot has ever sent.
*/

-- AlterTable
ALTER TABLE "NotificationLog"
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
-- Added with a default so this succeeds on a populated table, then the default
-- is dropped so Prisma owns the value from here on (as it does for every other
-- `@updatedAt` column in this schema).
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "sentAt" DROP NOT NULL,
ALTER COLUMN "sentAt" DROP DEFAULT;

-- Every pre-existing row was inserted by the claim-and-send path, so it was
-- delivered. Marking them `pending` would re-send them all.
UPDATE "NotificationLog" SET "status" = 'sent', "updatedAt" = "sentAt" WHERE "sentAt" IS NOT NULL;

-- A row with no `sentAt` predates this migration only if a claim was abandoned
-- mid-flight. It has no delivery to retry from, so it is closed out rather than
-- left pending forever.
UPDATE "NotificationLog" SET "status" = 'failed' WHERE "sentAt" IS NULL;

ALTER TABLE "NotificationLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Snooze" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "birthdayYear" INTEGER NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snooze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snooze_status_nextAttemptAt_idx" ON "Snooze"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Snooze_userId_status_idx" ON "Snooze"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Snooze_userId_personId_birthdayYear_daysBefore_key" ON "Snooze"("userId", "personId", "birthdayYear", "daysBefore");

-- CreateIndex
CREATE INDEX "NotificationLog_status_nextAttemptAt_idx" ON "NotificationLog"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "Snooze" ADD CONSTRAINT "Snooze_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snooze" ADD CONSTRAINT "Snooze_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
