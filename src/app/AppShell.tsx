import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { api } from './api';
import { Icon, ThemeSwitch } from './components/ui';
import { GROUP_ORDER, dateGroup, displayName, initials, useHistory, type AiProject, type HistoryItem } from './history';

const COLLAPSED_KEY = 'sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

type Me = { email: string; is_admin: boolean };

export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  useEffect(() => setDrawer(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1'); } catch {}
      return !c;
    });
  };

  return (
    <div className={`app${collapsed ? ' is-collapsed' : ''}${drawer ? ' drawer-open' : ''}`}>
      <aside className="sidebar" aria-label="Sidebar">
        <div className="sidebar-head">
          <Link to="/" className="sidebar-brand" title="Guru">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            <span className="sidebar-text">Guru</span>
          </Link>
          <button type="button" className="icon-btn icon-btn-sm sidebar-collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'} title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}>
            <Icon name={collapsed ? 'sidebar-open' : 'sidebar-close'} size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn-sm sidebar-close" onClick={() => setDrawer(false)} aria-label="Tutup navigasi">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="sidebar-scroll">
          <SidebarBody />
        </div>

        <div className="sidebar-foot">
          <ThemeSwitch />
          <AccountMenu me={me} />
        </div>
      </aside>

      <div className="sidebar-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="app-content">
        <header className="mobile-bar">
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => setDrawer(true)} aria-label="Buka navigasi">
            <Icon name="menu" size={18} />
          </button>
          <Link to="/" className="sidebar-brand">
            <img src="/favicon.svg" alt="" width="24" height="24" />
            <span>Guru</span>
          </Link>
          <span className="who">{displayName(me.email)}</span>
        </header>

        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Bagian tengah sidebar: Chat baru, Cari, Pinned, Projects, Recent. */
function SidebarBody() {
  const { version, bump } = useHistory();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim(), 250);
  const [pinned, setPinned] = useState<HistoryItem[]>([]);
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    let alive = true;
    const search = debounced ? `&q=${encodeURIComponent(debounced)}` : '';
    Promise.all([
      api<{ items: HistoryItem[] }>('/api/ai/history?pinned=1&limit=50').catch(() => ({ items: [] as HistoryItem[] })),
      api<{ items: HistoryItem[] }>(`/api/ai/history?limit=100${search}`).catch(() => ({ items: [] as HistoryItem[] })),
      api<{ items: AiProject[] }>('/api/ai/projects').catch(() => ({ items: [] as AiProject[] })),
    ]).then(([p, r, pr]) => {
      if (!alive) return;
      setPinned(p.items);
      setRecent(r.items);
      setProjects(pr.items);
    });
    return () => { alive = false; };
  }, [version, debounced]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of recent) {
      const g = dateGroup(item.createdAt);
      map.set(g, [...(map.get(g) ?? []), item]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }));
  }, [recent]);

  const togglePin = async (item: HistoryItem) => {
    await api(`/api/ai/questions/${item.id}`, { method: 'PATCH', body: { pinned: !item.pinned } }).catch(() => {});
    bump();
  };

  const remove = async (item: HistoryItem) => {
    if (!window.confirm('Hapus pertanyaan ini dari riwayat?')) return;
    await api(`/api/ai/questions/${item.id}`, { method: 'DELETE' }).catch(() => {});
    if (pathname === `/chat/${item.id}`) navigate('/');
    bump();
  };

  const createProject = async (e: FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const created = await api<{ id: string; name: string }>('/api/ai/projects', { method: 'POST', body: { name } }).catch(() => null);
    setProjectName('');
    setCreating(false);
    bump();
    if (created) navigate(`/projects/${created.id}`);
  };

  return (
    <nav className="sidebar-nav" aria-label="Menu">
      <NavLink to="/" end className="side-link" title="Chat baru">
        <Icon name="plus" size={16} />
        <span className="sidebar-text">Chat baru</span>
      </NavLink>
      <button type="button" className={`side-link side-button${searching ? ' is-current' : ''}`} onClick={() => setSearching((s) => !s)} aria-expanded={searching} title="Cari">
        <Icon name="search" size={16} />
        <span className="sidebar-text">Cari</span>
      </button>
      {searching && (
        <div className="sidebar-search sidebar-text">
          <input className="input input-sm" type="search" placeholder="Cari pertanyaan…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari pertanyaan" autoFocus />
        </div>
      )}

      {pinned.length > 0 && (
        <section className="sidebar-section">
          <p className="sidebar-label sidebar-text">Pinned</p>
          {pinned.map((item) => <HistoryRow key={item.id} item={item} active={pathname === `/chat/${item.id}`} onPin={togglePin} onDelete={remove} />)}
        </section>
      )}

      <section className="sidebar-section">
        <div className="sidebar-label-row">
          <p className="sidebar-label sidebar-text">Projects</p>
          <button type="button" className="icon-btn icon-btn-sm icon-btn-plain sidebar-text" onClick={() => setCreating((c) => !c)} aria-label="Buat project" title="Buat project">
            <Icon name="plus" size={14} />
          </button>
        </div>
        {creating && (
          <form className="sidebar-project-form sidebar-text" onSubmit={createProject}>
            <input className="input input-sm" placeholder="Nama project" value={projectName} onChange={(e) => setProjectName(e.target.value)} aria-label="Nama project" autoFocus maxLength={80} />
          </form>
        )}
        {projects.map((p) => (
          <NavLink key={p.id} to={`/projects/${p.id}`} className="side-link" title={p.name}>
            <Icon name="folder" size={16} />
            <span className="sidebar-text truncate">{p.name}</span>
            {p.count > 0 && <span className="side-count sidebar-text">{p.count}</span>}
          </NavLink>
        ))}
        {projects.length === 0 && !creating && <p className="sidebar-empty sidebar-text">Belum ada project.</p>}
      </section>

      <section className="sidebar-section">
        <p className="sidebar-label sidebar-text">Recent</p>
        {recent.length === 0 && <p className="sidebar-empty sidebar-text">{debounced ? 'Tidak ada yang cocok.' : 'Belum ada pertanyaan.'}</p>}
        {groups.map((g) => (
          <div key={g.label} className="sidebar-group">
            <p className="sidebar-sublabel sidebar-text">{g.label}</p>
            {g.items.map((item) => <HistoryRow key={item.id} item={item} active={pathname === `/chat/${item.id}`} onPin={togglePin} onDelete={remove} />)}
          </div>
        ))}
      </section>
    </nav>
  );
}

function HistoryRow({ item, active, onPin, onDelete }: { item: HistoryItem; active: boolean; onPin: (i: HistoryItem) => void; onDelete: (i: HistoryItem) => void }) {
  return (
    <div className={`history-row${active ? ' is-current' : ''}`}>
      <NavLink to={`/chat/${item.id}`} className="side-link history-link" title={item.question}>
        <Icon name="chat" size={14} />
        <span className="sidebar-text truncate">{item.question}</span>
      </NavLink>
      <div className="history-actions sidebar-text">
        <button type="button" className={`icon-btn icon-btn-sm icon-btn-plain${item.pinned ? ' is-on' : ''}`} onClick={() => onPin(item)} aria-label={item.pinned ? 'Lepas pin' : 'Pin'} title={item.pinned ? 'Lepas pin' : 'Pin'}>
          <Icon name="pin" size={13} />
        </button>
        <button type="button" className="icon-btn icon-btn-sm icon-btn-plain" onClick={() => onDelete(item)} aria-label="Hapus" title="Hapus">
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

/** Blok akun di bawah sidebar: avatar dan nama, dengan menu Profil, Pengaturan (admin), dan Keluar. */
/** Blok akun di bawah sidebar, dengan dropdown yang sama seperti Silpasala (DS dropdown + menu). */
function AccountMenu({ me }: { me: Me }) {
  const name = displayName(me.email);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.assign('/');
  };

  return (
    <div className="dropdown dropdown-up sidebar-user">
      <button type="button" className="user-btn" data-ds-toggle="dropdown" aria-expanded="false" aria-haspopup="menu" aria-label="Akun" title={me.email}>
        <span className="avatar">{initials(me.email)}</span>
        <span className="sidebar-text user-btn-text">
          <strong className="truncate">{name}</strong>
          <span className="truncate">{me.is_admin ? 'Admin' : me.email}</span>
        </span>
        <Icon name="chevron-up" size={12} className="sidebar-text" />
      </button>
      <div className="menu" role="menu">
        <div className="menu-user">
          <strong>{name}</strong>
          <span className="text-sm text-muted">{me.email}</span>
        </div>
        <div className="menu-divider" role="separator" />
        <Link to="/profil" className="menu-item" role="menuitem">
          <Icon name="user" /> Profil
        </Link>
        {me.is_admin && (
          <Link to="/settings" className="menu-item" role="menuitem">
            <Icon name="settings" /> Pengaturan
          </Link>
        )}
        <div className="menu-divider" role="separator" />
        <button type="button" className="menu-item" role="menuitem" onClick={signOut}>
          <Icon name="logout" /> Keluar
        </button>
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
