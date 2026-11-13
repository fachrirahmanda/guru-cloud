import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Icon } from '../components/ui';
import { useHistory, type AiProject, type HistoryItem } from '../history';

/** Isi satu project: pertanyaan di dalamnya, dan aksi ubah nama, chat baru, atau hapus project. */
export function ProjectView() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { version, bump } = useHistory();
  const [project, setProject] = useState<AiProject | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ items: AiProject[] }>('/api/ai/projects').then((r) => r.items.find((p) => p.id === id) ?? null).catch(() => null),
      api<{ items: HistoryItem[] }>(`/api/ai/history?project=${encodeURIComponent(id)}&limit=100`).then((r) => r.items).catch(() => []),
    ]).then(([p, list]) => {
      if (!alive) return;
      setProject(p);
      setName(p?.name ?? '');
      setItems(list);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [id, version]);

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) return;
    await api(`/api/ai/projects/${id}`, { method: 'PATCH', body: { name: next } }).catch(() => {});
    setRenaming(false);
    bump();
  };

  const remove = async () => {
    if (!window.confirm('Hapus project ini? Pertanyaan di dalamnya tetap ada di riwayat.')) return;
    await api(`/api/ai/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    bump();
    navigate('/');
  };

  if (loaded && !project) {
    return (
      <div className="page container">
        <p className="hint">Project tidak ditemukan.</p>
        <Link to="/">Kembali ke chat</Link>
      </div>
    );
  }

  return (
    <div className="page container">
      <header className="page-head">
        <div>
          {renaming ? (
            <form className="project-rename" onSubmit={rename}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nama project" autoFocus />
              <button type="submit" className="btn btn-primary btn-sm">Simpan</button>
              <button type="button" className="btn btn-sm" onClick={() => { setRenaming(false); setName(project?.name ?? ''); }}>Batal</button>
            </form>
          ) : (
            <h1>{project?.name ?? '…'}</h1>
          )}
          <p>{items.length} pertanyaan di project ini</p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/?project=${encodeURIComponent(id)}`)}>
            <Icon name="plus" size={14} /> Chat baru di project
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setRenaming(true)}>Ubah nama</button>
          <button type="button" className="btn btn-sm btn-danger-soft" onClick={remove}>
            <Icon name="trash" size={14} /> Hapus project
          </button>
        </div>
      </header>

      {loaded && items.length === 0 && (
        <div className="messages-empty">
          <strong>Belum ada pertanyaan</strong>
          Mulai chat baru di project ini, atau pindahkan pertanyaan dari riwayat.
        </div>
      )}

      <ul className="project-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/chat/${item.id}`} className="project-item">
              <span className="project-item-q truncate">{item.question}</span>
              <span className="hint">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
