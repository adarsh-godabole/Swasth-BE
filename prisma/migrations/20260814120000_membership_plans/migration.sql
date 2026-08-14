-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('DAY', 'MONTH');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIAL', 'PENDING');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "durationValue" INTEGER NOT NULL,
    "durationUnit" "DurationUnit" NOT NULL DEFAULT 'MONTH',
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "gymUserId" UUID NOT NULL,
    "planId" UUID,
    "planName" VARCHAR(80) NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" "DurationUnit" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(300),
    "notes" VARCHAR(500),
    "soldById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_gymId_isActive_sortOrder_idx" ON "plans"("gymId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "plans_gymId_name_key" ON "plans"("gymId", "name");

-- CreateIndex
CREATE INDEX "subscriptions_gymId_gymUserId_endDate_idx" ON "subscriptions"("gymId", "gymUserId", "endDate");

-- CreateIndex
CREATE INDEX "subscriptions_gymId_endDate_idx" ON "subscriptions"("gymId", "endDate");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_gymUserId_fkey" FOREIGN KEY ("gymUserId") REFERENCES "gym_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "gym_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

