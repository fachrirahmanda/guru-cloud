-- Projects untuk mengelompokkan pertanyaan Ask AI (per pengguna)
CREATE TABLE IF NOT EXISTS ai_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_projects_user ON ai_projects(user_id, created_at DESC);

-- Pertanyaan bisa masuk project dan bisa di-pin
ALTER TABLE ai_questions ADD COLUMN project_id TEXT;
ALTER TABLE ai_questions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_questions_pinned ON ai_questions(user_id, pinned);
