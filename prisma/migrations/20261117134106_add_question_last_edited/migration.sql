-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'QUESTION_EDITED';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "lastEditedAt" TIMESTAMP(3);
