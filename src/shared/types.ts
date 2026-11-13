export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Chat {
  id: number;
  name: string | null;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_email: string;
  content: string;
  created_at: string;
}

export interface Member {
  id: number;
  email: string;
  is_admin: number;
  created_at: string;
}

/** Ask AI: an earlier question and answer, sent along for follow-ups. */
export interface AiTurn {
  question: string;
  answer: string;
}

/** One of the signed-in person's own earlier Ask AI questions (kept 90 days). */
export interface AiHistoryItem {
  id: string;
  question: string;
  answer: string;
  keys: string[];
  createdAt: number;
}

export interface AiHistoryPage {
  items: AiHistoryItem[];
  hasMore: boolean;
}

/** An image sent with a question (a screenshot pasted or attached), base64. */
export interface AiImage {
  mimeType: string;
  data: string;
}
export const AI_IMAGE_MAX = 6;

/** A file sent with an Ask AI question (e.g. a test report to update statuses from): a spreadsheet read as text in the browser, or a PDF (base64). */
export interface AiFile {
  name: string;
  text?: string;
  pdf?: string;
}

/** A change Ask AI proposes when asked to update tickets; the person confirms before it's made. */
export interface AiAction {
  key: string;
  field: 'status' | 'stage';
  to: string;
  /** Why, in a few words (e.g. "passed in the screenshot"). */
  reason: string;
}

export interface AiAnswer {
  answer: string;
  /** Keys of the issues the answer is about (or that match a search), most relevant first. */
  keys: string[];
  /** Status or stage changes it proposes (only when asked to change tickets). */
  actions: AiAction[];
}

/** Admin: the Ask AI (Gemini) setup. The key itself never leaves the server. */
export interface AiSettings {
  /** Which one answers Ask AI (and every other AI feature). */
  provider: 'gemini' | 'nvidia';
  /** Gemini: */
  configured: boolean;
  /** Where the key comes from: this page, or the GEMINI_API_KEY secret. */
  source: 'settings' | 'secret' | null;
  /** Last characters of the key ("…a1B2"), or "secret". */
  keyHint: string | null;
  model: string;
  defaultModel: string;
}
