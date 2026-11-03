-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'INTERVIEW', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ConsolePreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolePadAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsolePadAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicVideo" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "posterPath" TEXT,
    "status" "TrackStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternApplication" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "areas" TEXT[],
    "hoursPerWeek" INTEGER,
    "availability" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "resumePath" TEXT,
    "resumeMime" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsolePreset_userId_idx" ON "ConsolePreset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolePadAsset_key_key" ON "ConsolePadAsset"("key");

-- CreateIndex
CREATE INDEX "ConsolePadAsset_userId_idx" ON "ConsolePadAsset"("userId");

-- CreateIndex
CREATE INDEX "MusicVideo_status_sortOrder_idx" ON "MusicVideo"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "InternApplication_status_idx" ON "InternApplication"("status");
