-- AlterTable: 동일 신고자가 같은 대상을 중복 신고하는 것을 DB 레벨에서 차단
-- (사전에 UserReport 테이블에 (reporterId, reportedId) 중복 데이터 없음을 확인함)
CREATE UNIQUE INDEX "UserReport_reporterId_reportedId_key" ON "UserReport"("reporterId", "reportedId");
