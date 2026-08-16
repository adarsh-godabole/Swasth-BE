-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('APP', 'FRONT_DESK');

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "gymUserId" UUID NOT NULL,
    "subscriptionId" UUID,
    "localDate" DATE NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "CheckInSource" NOT NULL DEFAULT 'APP',
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "check_ins_gymId_localDate_idx" ON "check_ins"("gymId", "localDate");

-- CreateIndex
CREATE INDEX "check_ins_gymUserId_localDate_idx" ON "check_ins"("gymUserId", "localDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_gymUserId_localDate_key" ON "check_ins"("gymUserId", "localDate");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_gymUserId_fkey" FOREIGN KEY ("gymUserId") REFERENCES "gym_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "gym_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

