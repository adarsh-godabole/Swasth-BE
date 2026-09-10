-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'ABS', 'TRAPS', 'LATS', 'LOWER_BACK', 'GLUTES', 'QUADS', 'HAMSTRINGS', 'CALVES', 'CARDIO', 'FULL_BODY');

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "gymUserId" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "muscleGroups" "MuscleGroup"[],
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workouts_checkInId_key" ON "workouts"("checkInId");

-- CreateIndex
CREATE INDEX "workouts_gymId_localDate_idx" ON "workouts"("gymId", "localDate");

-- CreateIndex
CREATE INDEX "workouts_gymUserId_localDate_idx" ON "workouts"("gymUserId", "localDate" DESC);

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_gymUserId_fkey" FOREIGN KEY ("gymUserId") REFERENCES "gym_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
