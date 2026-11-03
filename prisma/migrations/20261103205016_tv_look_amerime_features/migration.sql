-- AlterEnum
ALTER TYPE "TvKind" ADD VALUE 'MOVIE';

-- AlterTable
ALTER TABLE "TvBlock" ADD COLUMN     "breakEvery" INTEGER,
ADD COLUMN     "breakSeconds" INTEGER,
ADD COLUMN     "featureDate" TEXT,
ADD COLUMN     "featureStartMinute" INTEGER,
ADD COLUMN     "featureVideoId" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "logoPosition" TEXT,
ADD COLUMN     "logoSize" TEXT;

-- Saturday Morning Cartoons becomes "Saturday Vibe Amerime": Saturdays 9–11 AM ET,
-- 1-minute commercial break after every show, with its own on-screen logo.
UPDATE "TvBlock"
SET "title" = 'Saturday Vibe Amerime', "startMinute" = 540, "endMinute" = 660,
    "breakEvery" = 1, "breakSeconds" = 60,
    "logoPath" = '/brand/saturday-vibe-amerime.webp', "logoPosition" = 'top-left', "logoSize" = 'md'
WHERE "title" = 'Saturday Morning Cartoons';
