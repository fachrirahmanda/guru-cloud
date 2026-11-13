-- Satu percakapan Ask AI bisa berisi banyak giliran (pertanyaan + jawaban).
-- Setiap baris ai_questions tetap satu giliran; conversation_id mengelompokkan giliran dalam satu sesi chat.
ALTER TABLE ai_questions ADD COLUMN conversation_id TEXT;

-- Riwayat lama: setiap pertanyaan dianggap percakapan sendiri (id baris = conversation_id).
UPDATE ai_questions SET conversation_id = id WHERE conversation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_questions_conversation ON ai_questions(user_id, conversation_id, created_at);
