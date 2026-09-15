-- Door QR check-in.

-- AlterEnum
ALTER TYPE "CheckInSource" ADD VALUE 'QR';

-- AlterTable: every existing gym needs a code before the column can be unique
-- and NOT NULL, so it is added nullable, backfilled, then tightened.
ALTER TABLE "gyms" ADD COLUMN "checkInCode" VARCHAR(16);

-- Backfill: 8 characters from a Crockford-style alphabet with I, L, O and U
-- removed, so nothing reads as 1/0 when a member types it off a poster.
UPDATE "gyms"
SET "checkInCode" = (
  SELECT string_agg(
    substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (floor(random() * 32) + 1)::int, 1),
    ''
  )
  FROM generate_series(1, 8)
)
WHERE "checkInCode" IS NULL;

ALTER TABLE "gyms" ALTER COLUMN "checkInCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "gyms_checkInCode_key" ON "gyms"("checkInCode");
