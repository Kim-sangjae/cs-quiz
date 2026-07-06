-- CreateEnum
CREATE TYPE "CommentReportReason" AS ENUM ('INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'OTHER');

-- AlterTable
ALTER TABLE "QuestionComment" ADD COLUMN     "blinded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CommentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reason" "CommentReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentReport_status_createdAt_idx" ON "CommentReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReport_reporterId_commentId_key" ON "CommentReport"("reporterId", "commentId");

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "QuestionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
