-- AlterTable
ALTER TABLE "Like" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestionNote" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionNote_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "BookmarkFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookmarkFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyGoalClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalKey" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyGoalClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionNote_userId_idx" ON "QuestionNote"("userId");

-- CreateIndex
CREATE INDEX "BookmarkFolder_userId_idx" ON "BookmarkFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkFolder_userId_name_key" ON "BookmarkFolder"("userId", "name");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WeeklyGoalClaim_userId_idx" ON "WeeklyGoalClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyGoalClaim_userId_goalKey_key" ON "WeeklyGoalClaim"("userId", "goalKey");

-- CreateIndex
CREATE INDEX "Like_userId_folderId_idx" ON "Like"("userId", "folderId");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BookmarkFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionNote" ADD CONSTRAINT "QuestionNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionNote" ADD CONSTRAINT "QuestionNote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookmarkFolder" ADD CONSTRAINT "BookmarkFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyGoalClaim" ADD CONSTRAINT "WeeklyGoalClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
