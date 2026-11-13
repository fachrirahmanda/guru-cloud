import { type FormEvent, useState } from 'react';
import { useApi } from '../api';
import { Icon, ThemeSwitch } from '../components/ui';

const HIGHLIGHTS = [
  { icon: 'sparkle', title: 'Jawaban dari dokumen', text: 'Tanyakan apa saja, atau lampirkan gambar dan PDF untuk dianalisis.' },
  { icon: 'bolt', title: 'Cepat dan ringkas', text: 'Jawaban langsung ke inti, dengan batas harian yang jelas.' },
  { icon: 'lock', title: 'Akses terdaftar', text: 'Hanya member yang sudah diundang admin yang bisa masuk.' },
];

// Decorative chat preview for the brand panel: a question and an answer, with placeholder lines.
const PREVIEW = [
  { who: 'user', width: [72, 46] },
  { who: 'ai', width: [88, 80, 54] },
] as const;

export function Login() {
  // Tombol dev login hanya muncul jika server mengizinkan (DEV_LOGIN=true, localhost).
  const { data: config } = useApi<{ devLogin: boolean }>('/api/auth/config');
  const devLogin = config?.devLogin === true;
  const [email, setEmail] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  const submitDevLogin = async (e: FormEvent) => {
    e.preventDefault();
    setDevError(null);
    setDevBusy(true);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      if (!res.ok) {
        setDevError(`Dev login gagal (${res.status}).`);
        return;
      }
      window.location.href = '/chat';
    } catch (err) {
      setDevError('Dev login gagal: ' + String(err));
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="login-hero">
        <div className="login-brand">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>Guru</span>
        </div>

        <div className="login-pitch">
          <h2>Tim chat yang terorganisir.</h2>
          <p>Tanya jawab dengan AI untuk seluruh tim, dengan akses yang hanya dibuka untuk member terdaftar.</p>
        </div>

        <div className="login-preview" aria-hidden="true">
          {PREVIEW.map((msg, i) => (
            <div key={i} className={`login-preview-msg is-${msg.who}`} style={{ ['--i' as string]: i }}>
              {msg.width.map((w, j) => (
                <span key={j} className="bar" style={{ width: `${w}%` }} />
              ))}
            </div>
          ))}
        </div>

        <ul className="login-highlights">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title}>
              <span className="login-highlight-icon"><Icon name={h.icon} size={16} /></span>
              <span>
                <strong>{h.title}</strong>
                <span>{h.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="login-main">
        <div className="login-theme">
          <ThemeSwitch />
        </div>

        <div className="login-card">
          <img src="/favicon.svg" alt="" width="44" height="44" className="login-card-logo" />
          <div className="login-card-head">
            <h1>Selamat datang</h1>
            <p>Masuk dengan akun Google Anda untuk melanjutkan.</p>
          </div>

          <a className="google-btn" href="/api/auth/login">
            <GoogleMark />
            Lanjutkan dengan Google
          </a>

          {devLogin && (
            <form className="dev-login" onSubmit={submitDevLogin}>
              <p className="menu-label">Pengembangan lokal</p>
              <div className="cluster">
                <input type="email" className="input" placeholder="dev@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
                <button type="submit" className="btn btn-primary" disabled={devBusy}>{devBusy ? 'Masuk…' : 'Masuk'}</button>
              </div>
              {devError && <p className="hint">{devError}</p>}
              <p className="hint">Dev login hanya aktif di localhost dengan DEV_LOGIN=true.</p>
            </form>
          )}

          <p className="login-note">
            <Icon name="lock" size={14} />
            Hanya akun Gmail yang sudah diundang admin yang dapat masuk.
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
