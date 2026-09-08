-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "embeddingFull" vector(1536);

CREATE INDEX IF NOT EXISTS idx_question_embedding_full ON "Question" USING hnsw ("embeddingFull" vector_cosine_ops);
