-- CreateTable
CREATE TABLE "DailyChallengeStat" (
    "date" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyChallengeStat_pkey" PRIMARY KEY ("date")
);
