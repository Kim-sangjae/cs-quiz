CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_question_embedding ON "Question" USING hnsw (embedding vector_cosine_ops);
