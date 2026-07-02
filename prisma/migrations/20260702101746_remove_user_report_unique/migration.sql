-- DropIndex
DROP INDEX "UserReport_reporterId_reportedId_key";

-- CreateIndex
CREATE INDEX "UserReport_reporterId_idx" ON "UserReport"("reporterId");
