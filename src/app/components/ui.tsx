import { type ReactNode, useState } from 'react';

const PATHS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  pin: <path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3-1-6z" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.5h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  comment: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12z" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  send: <><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7z" /></>,
  attachment: <path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  logout: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  'sidebar-close': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M16 10l-2 2 2 2" /></>,
  'sidebar-open': <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M14 10l2 2-2 2" /></>,
};

export function Icon({ name, size = 16, className, style }: { name: keyof typeof PATHS | string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** The Guru bubble with three dots that bounce in turn. Same markup as the preloader in index.html. */
export function Preloader() {
  return (
    <div className="boot" role="status" aria-label="Memuat Guru">
      <div className="boot-bubble">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <defs><linearGradient id="boot-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d2a20" /><stop offset="1" stopColor="#2a1a12" /></linearGradient></defs>
          <rect width="32" height="32" fill="url(#boot-g)" />
          <path className="bubble" d="M16 7.5c-5.5 0-9.5 3.4-9.5 7.8 0 2.1.9 3.9 2.4 5.2L7.8 24.5l4.1-1.9c1.2.4 2.5.6 4.1.6 5.5 0 9.5-3.4 9.5-7.8S21.5 7.5 16 7.5z" fill="#f5f0e6" />
          <circle className="dot" cx="11.5" cy="15.3" r="1.5" fill="#d14210" />
          <circle className="dot dot-2" cx="16" cy="15.3" r="1.5" fill="#d14210" />
          <circle className="dot dot-3" cx="20.5" cy="15.3" r="1.5" fill="#d14210" />
        </svg>
      </div>
    </div>
  );
}

const THEMES = ['system', 'light', 'dark'] as const;
type ThemeChoice = (typeof THEMES)[number];

function currentTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Light / system / dark. Uses the design system's setter when it has loaded, so the page follows it. */
export function ThemeSwitch() {
  const [current, setCurrent] = useState<ThemeChoice>(currentTheme);
  const pick = (t: ThemeChoice) => {
    setCurrent(t);
    if (window.DS?.setTheme) {
      window.DS.setTheme(t, true);
    } else {
      try {
        if (t === 'system') localStorage.removeItem('theme');
        else localStorage.setItem('theme', t);
      } catch {}
      if (t === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
    }
  };
  return (
    <div className="theme-switch" role="group" aria-label="Tema">
      {THEMES.map((t) => (
        <button key={t} type="button" data-theme-value={t} aria-pressed={t === current} aria-label={`Tema ${t === 'system' ? 'sistem' : t === 'light' ? 'terang' : 'gelap'}`} title={t === 'system' ? 'Sistem' : t === 'light' ? 'Terang' : 'Gelap'} onClick={() => pick(t)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {t === 'system' && <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>}
            {t === 'light' && <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
            {t === 'dark' && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
          </svg>
        </button>
      ))}
    </div>
  );
}
