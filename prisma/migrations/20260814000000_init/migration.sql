-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GymRole" AS ENUM ('MEMBER', 'TRAINER', 'GYM_ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "GymUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "MemberSource" AS ENUM ('APP_SIGNUP', 'FRONT_DESK', 'IMPORT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "FitnessGoal" AS ENUM ('WEIGHT_LOSS', 'MUSCLE_GAIN', 'GENERAL_FITNESS', 'ENDURANCE', 'REHAB');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('BEGINNER', 'OCCASIONAL', 'REGULAR');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PHONE_UPDATE');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "gyms" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "legalName" VARCHAR(160),
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(12),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "logoUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "memberCodePrefix" VARCHAR(10) NOT NULL DEFAULT 'M',
    "memberSeq" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" VARCHAR(255),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "fullName" VARCHAR(120),
    "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "dateOfBirth" DATE,
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "avatarUrl" VARCHAR(500),
    "city" VARCHAR(100),
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_users" (
    "id" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "GymRole" NOT NULL DEFAULT 'MEMBER',
    "status" "GymUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "memberCode" VARCHAR(30),
    "source" "MemberSource" NOT NULL DEFAULT 'APP_SIGNUP',
    "goal" "FitnessGoal",
    "activityLevel" "ActivityLevel",
    "medicalNotes" VARCHAR(1000),
    "notes" VARCHAR(1000),
    "emergencyContactName" VARCHAR(120),
    "emergencyContactPhone" VARCHAR(20),
    "onboardedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "phone" VARCHAR(20) NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gymId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "familyId" UUID NOT NULL,
    "deviceId" UUID,
    "userAgent" VARCHAR(300),
    "ipAddress" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "pushToken" VARCHAR(500),
    "appVersion" VARCHAR(30),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gyms_code_key" ON "gyms"("code");

-- CreateIndex
CREATE INDEX "gyms_isActive_idx" ON "gyms"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "gym_users_gymId_role_status_idx" ON "gym_users"("gymId", "role", "status");

-- CreateIndex
CREATE INDEX "gym_users_gymId_joinedAt_idx" ON "gym_users"("gymId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "gym_users_gymId_userId_key" ON "gym_users"("gymId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "gym_users_gymId_memberCode_key" ON "gym_users"("gymId", "memberCode");

-- CreateIndex
CREATE INDEX "otp_requests_phone_purpose_createdAt_idx" ON "otp_requests"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_requests_expiresAt_idx" ON "otp_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_userId_pushToken_key" ON "devices"("userId", "pushToken");

-- AddForeignKey
ALTER TABLE "gym_users" ADD CONSTRAINT "gym_users_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_users" ADD CONSTRAINT "gym_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

