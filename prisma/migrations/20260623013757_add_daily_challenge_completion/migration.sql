-- CreateTable
CREATE TABLE "DailyChallengeCompletion" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallengeCompletion_pkey" PRIMARY KEY ("userId","date")
);

-- CreateIndex
CREATE INDEX "DailyChallengeCompletion_userId_idx" ON "DailyChallengeCompletion"("userId");

-- AddForeignKey
ALTER TABLE "DailyChallengeCompletion" ADD CONSTRAINT "DailyChallengeCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
