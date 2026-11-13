import { createContext, useContext, useState, type ReactNode } from 'react';

/** Satu pertanyaan Ask AI yang tersimpan. */
export type HistoryItem = {
  id: string;
  question: string;
  answer: string;
  keys: string[];
  createdAt: number;
  projectId: string | null;
  pinned: boolean;
};

export type AiProject = { id: string; name: string; count: number };

type HistoryCtx = { version: number; bump: () => void };
const Ctx = createContext<HistoryCtx>({ version: 0, bump: () => {} });

/** Sidebar dan halaman chat berbagi satu penghitung: setiap perubahan riwayat memanggil bump(). */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  return <Ctx.Provider value={{ version, bump: () => setVersion((v) => v + 1) }}>{children}</Ctx.Provider>;
}

export const useHistory = () => useContext(Ctx);

/** Nama tampilan dari email: "fachri.rahmanda@gmail.com" → "Fachri Rahmanda". */
export function displayName(email: string) {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ') || email;
}

/** Inisial untuk avatar: dua huruf pertama dari nama. */
export function initials(email: string) {
  const parts = displayName(email).split(' ').filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? email)[0] ?? '?';
  return letters.toUpperCase();
}

/** Kelompok tanggal seperti sidebar chat: Hari ini, Kemarin, 7 hari terakhir, Lebih lama. */
export function dateGroup(ts: number, now = Date.now()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= startOfToday.getTime()) return 'Hari ini';
  if (ts >= startOfToday.getTime() - day) return 'Kemarin';
  if (ts >= startOfToday.getTime() - 7 * day) return '7 hari terakhir';
  return 'Lebih lama';
}

export const GROUP_ORDER = ['Hari ini', 'Kemarin', '7 hari terakhir', 'Lebih lama'];
