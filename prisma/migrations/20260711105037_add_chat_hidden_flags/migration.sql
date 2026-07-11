-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "hiddenByReceiver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiddenBySender" BOOLEAN NOT NULL DEFAULT false;
