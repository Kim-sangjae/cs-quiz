-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('FIRST_QUIZ', 'QUIZ_10', 'QUIZ_50', 'PERFECT_SCORE', 'STREAK_3', 'STREAK_7', 'CAT_DS', 'CAT_ALGO', 'CAT_OS', 'CAT_NETWORK', 'CAT_DB', 'CAT_ARCH');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BADGE_EARNED';

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badge" "BadgeType" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badge_key" ON "UserBadge"("userId", "badge");

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
