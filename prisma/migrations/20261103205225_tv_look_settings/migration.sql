-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "tvBugOpacity" INTEGER NOT NULL DEFAULT 85,
ADD COLUMN     "tvBugPath" TEXT,
ADD COLUMN     "tvBugPosition" TEXT NOT NULL DEFAULT 'top-right',
ADD COLUMN     "tvBugSize" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "tvLayout" TEXT NOT NULL DEFAULT 'logo-top';
