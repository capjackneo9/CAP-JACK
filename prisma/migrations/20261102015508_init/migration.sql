-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STATION_MANAGER', 'DJ_HOST', 'MUSIC_REVIEWER', 'ADVERTISER', 'ARTIST');

-- CreateEnum
CREATE TYPE "TrackCategory" AS ENUM ('CAPRIO_ORIGINALS', 'VIBE_MUSIC', 'ATL_SOUL', 'ALT_DIMENSION', 'GOSPEL_CINEMATIC', 'VIBE_19', 'INDEPENDENT_AI', 'DJ_MIXES', 'INTERVIEWS', 'STATION_IDS', 'COMMERCIALS', 'SOUND_EFFECTS');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SCHEDULED', 'BROADCAST_COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('INTERVIEW', 'COMMERCIAL_SPOT', 'COMMERCIAL_PRODUCTION', 'SHOW_SPONSORSHIP', 'ARTIST_SHOWCASE', 'HOSTED_SHOW', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgramFormat" AS ENUM ('LIVE', 'PRERECORDED', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('NOT_LINKED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'WAITING', 'ON_AIR', 'ENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "azuracastStationId" TEXT,
    "rotationCaprioPct" INTEGER NOT NULL DEFAULT 75,
    "rotationIndiePct" INTEGER NOT NULL DEFAULT 15,
    "rotationGuestPct" INTEGER NOT NULL DEFAULT 10,
    "showListenerCount" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "imagePath" TEXT,
    "links" JSONB,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "azuracastStreamerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "imagePath" TEXT,
    "links" JSONB,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isCaprio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "disclosure" TEXT NOT NULL DEFAULT 'Paid sponsorship',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "format" "ProgramFormat" NOT NULL DEFAULT 'AUTOMATED',
    "imagePath" TEXT,
    "featuredGuest" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT true,
    "bucket" TEXT NOT NULL DEFAULT 'CAPRIO',
    "hostId" TEXT,
    "sponsorId" TEXT,
    "azuracastPlaylistId" INTEGER,
    "syncState" "SyncState" NOT NULL DEFAULT 'NOT_LINKED',
    "syncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleOverride" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "artistId" TEXT,
    "album" TEXT,
    "genre" TEXT,
    "category" "TrackCategory" NOT NULL,
    "status" "TrackStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "durationSec" INTEGER,
    "isrc" TEXT,
    "credits" TEXT,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "filePath" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "artworkPath" TEXT,
    "playlists" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "azuracastMediaId" INTEGER,
    "azuracastPath" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "songTitle" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "audioMime" TEXT NOT NULL,
    "audioSize" INTEGER NOT NULL,
    "artworkPath" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "aiToolsUsed" TEXT,
    "commercialRightsConfirmed" BOOLEAN NOT NULL,
    "broadcastPermissionGranted" BOOLEAN NOT NULL,
    "promoPackage" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE',
    "stripeSessionId" TEXT,
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "BookingType" NOT NULL,
    "priceMinCents" INTEGER,
    "priceMaxCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "type" "BookingType" NOT NULL,
    "productId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "phone" TEXT,
    "details" TEXT NOT NULL,
    "preferredDates" TEXT,
    "mediaPath" TEXT,
    "priceCents" INTEGER,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE',
    "stripeSessionId" TEXT,
    "disclosureAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestInvite" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "programId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "tokenHash" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "recordingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "guestConsentedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" JSONB,
    "liveImpact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Station_slug_key" ON "Station"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Host_slug_key" ON "Host"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Host_userId_key" ON "Host"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Program_stationId_slug_key" ON "Program"("stationId", "slug");

-- CreateIndex
CREATE INDEX "ScheduleSlot_dayOfWeek_idx" ON "ScheduleSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ScheduleOverride_startsAt_endsAt_idx" ON "ScheduleOverride"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Track_submissionId_key" ON "Track"("submissionId");

-- CreateIndex
CREATE INDEX "Track_status_category_idx" ON "Track"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_stripeSessionId_key" ON "Submission"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_stationId_slug_key" ON "Product"("stationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripeSessionId_key" ON "Booking"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestInvite_tokenHash_key" ON "GuestInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Host" ADD CONSTRAINT "Host_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsor" ADD CONSTRAINT "Sponsor_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
