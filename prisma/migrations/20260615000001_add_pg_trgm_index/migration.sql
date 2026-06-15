CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_question_trgm ON "Question" USING GIN (question gin_trgm_ops);
