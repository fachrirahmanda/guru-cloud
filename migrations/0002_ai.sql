-- Tabel riwayat pertanyaan Ask AI per pengguna
CREATE TABLE IF NOT EXISTS ai_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keys TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_questions_user ON ai_questions(user_id, created_at DESC);

-- Tabel penggunaan harian Ask AI (batas 50 pertanyaan per hari per pengguna)
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Tabel pengaturan aplikasi (kunci terenkripsi untuk AI dan Drive)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
