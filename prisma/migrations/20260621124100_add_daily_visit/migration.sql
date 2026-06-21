-- CreateTable
CREATE TABLE "DailyVisit" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "DailyVisit_pkey" PRIMARY KEY ("userId","date")
);

-- AddForeignKey
ALTER TABLE "DailyVisit" ADD CONSTRAINT "DailyVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
