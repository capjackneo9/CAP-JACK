-- CreateEnum
CREATE TYPE "TvKind" AS ENUM ('MUSIC_VIDEO', 'CARTOON', 'PROGRAM', 'COMMERCIAL');

-- DropIndex
DROP INDEX "MusicVideo_status_sortOrder_idx";

-- AlterTable
ALTER TABLE "MusicVideo" ADD COLUMN     "advertiser" TEXT,
ADD COLUMN     "endsOn" TIMESTAMP(3),
ADD COLUMN     "kind" "TvKind" NOT NULL DEFAULT 'MUSIC_VIDEO',
ADD COLUMN     "startsOn" TIMESTAMP(3),
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "tvBreakEvery" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "tvBreakSeconds" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "tvCommercialsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TvBlock" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "days" INTEGER[],
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "kind" "TvKind" NOT NULL,
    "commercials" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusicVideo_kind_status_sortOrder_idx" ON "MusicVideo"("kind", "status", "sortOrder");
