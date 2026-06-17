-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LEVEL_UP';

-- DropIndex
DROP INDEX "AuditLog_action_idx";

-- DropIndex
DROP INDEX "AuditLog_actorId_idx";

-- DropIndex
DROP INDEX "AuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "idx_question_embedding";

-- DropIndex
DROP INDEX "idx_question_trgm";
