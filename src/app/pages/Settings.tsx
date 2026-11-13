import { useEffect, useState } from 'react';
import { useApi, api } from '../api';
import { Icon } from '../components/ui';
import type { AiSettings } from '../../shared/types';

const GEMINI_MODEL_OPTIONS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
];

const NVIDIA_MODEL_OPTIONS = [
  // Model vision: bisa membaca gambar dan PDF yang dilampirkan di Ask AI.
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'openai/gpt-oss-20b',
  'deepseek-ai/deepseek-v4.1-flash',
  'z-ai/glm-5.3-flash',
  'minimaxai/minimax-m3.1-flash',
];

const DEFAULT_MODEL = {
  gemini: 'gemini-flash-latest',
  nvidia: 'nvidia/nemotron-3.5-lightning-30b-a3b',
} as const;

type Member = { id: number; email: string; is_admin: number; created_at: string };

export function Settings() {
  const [activeTab, setActiveTab] = useState<'member' | 'ai'>('member');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'nvidia'>('gemini');
  const [savingAi, setSavingAi] = useState(false);

  const { data: membersData, reload: reloadMembers } = useApi<Member[]>('/api/members');
  const { data: aiData } = useApi<AiSettings>('/api/ai/settings');

  useEffect(() => {
    if (membersData) setMembers(membersData);
  }, [membersData]);

  useEffect(() => {
    if (aiData) {
      setAiSettings(aiData);
      setAiProvider(aiData.provider);
      setAiModel(aiData.model);
    }
  }, [aiData]);

  const clearMsg = () => setMsg(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      await api('/api/members', {
        method: 'POST',
        body: { email: email.trim(), is_admin: isAdmin },
      });
      setEmail('');
      setIsAdmin(false);
      setMsg({ kind: 'success', text: 'Member berhasil ditambahkan.' });
      reloadMembers();
    } catch (err: any) {
      setMsg({ kind: 'error', text: err.message?.includes('409') ? 'Email sudah terdaftar.' : 'Gagal menambahkan member.' });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Hapus member ini?')) return;
    setDeleting(id);
    try {
      await api(`/api/members/${id}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setMsg({ kind: 'success', text: 'Member berhasil dihapus.' });
    } catch {
      setMsg({ kind: 'error', text: 'Gagal menghapus member.' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAi(true);
    setMsg(null);
    try {
      await api('/api/ai/settings', {
        method: 'POST',
        body: { key: aiKey.trim() || undefined, model: aiModel.trim() || undefined, provider: aiProvider },
      });
      setAiKey('');
      setMsg({ kind: 'success', text: 'Pengaturan AI tersimpan.' });
      const fresh = await api<AiSettings>('/api/ai/settings');
      setAiSettings(fresh);
      setAiProvider(fresh.provider);
      setAiModel(fresh.model);
    } catch (err: any) {
      setMsg({ kind: 'error', text: err.message || 'Gagal menyimpan pengaturan AI.' });
    } finally {
      setSavingAi(false);
    }
  };

  // Ganti provider = ganti juga model ke default provider itu (model Gemini tidak berlaku untuk NVIDIA).
  const changeProvider = (next: 'gemini' | 'nvidia') => {
    setAiProvider(next);
    setAiModel(DEFAULT_MODEL[next]);
  };

  const baseOptions = aiProvider === 'nvidia' ? NVIDIA_MODEL_OPTIONS : GEMINI_MODEL_OPTIONS;
  // Jika model tersimpan tidak ada di daftar, tetap tampilkan agar pilihan tidak tampak salah.
  const modelOptions = aiModel && !baseOptions.includes(aiModel) ? [aiModel, ...baseOptions] : baseOptions;
  const defaultModel = DEFAULT_MODEL[aiProvider];

  return (
    <div className="page container">
      <header className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p>{activeTab === 'member' ? 'Kelola member yang boleh mengakses Guru.' : 'Atur provider dan model untuk Tanya Guru AI.'}</p>
        </div>
      </header>

      <div className="tabs settings-tabs" role="tablist" aria-label="Bagian pengaturan">
        <button type="button" role="tab" aria-selected={activeTab === 'member'} className={`tab${activeTab === 'member' ? ' is-active' : ''}`} onClick={() => setActiveTab('member')}>
          <Icon name="users" size={15} /> Member
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'ai'} className={`tab${activeTab === 'ai' ? ' is-active' : ''}`} onClick={() => setActiveTab('ai')}>
          <Icon name="sparkle" size={15} /> AI
        </button>
      </div>

      {msg && (
        <div className={`alert ${msg.kind === 'success' ? 'alert-success' : 'alert-danger'}`} role="alert" onClick={clearMsg} style={{ marginBottom: 16, cursor: 'pointer' }}>
          <Icon name={msg.kind === 'success' ? 'check' : 'alert'} size={18} />
          <div className="alert-content"><p>{msg.text}</p></div>
        </div>
      )}

      {activeTab === 'member' ? (
        <div className="settings-grid is-wide">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">Tambah member</h2>
              <p className="card-subtitle">Hanya email Gmail yang bisa masuk.</p>
              <form onSubmit={handleAdd} style={{ marginTop: 16 }}>
                <div className="field">
                  <label className="field-label" htmlFor="member-email">Email Gmail</label>
                  <input id="member-email" className="input" type="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={adding} />
                </div>
                <label className="cluster" style={{ alignItems: 'center', gap: 8, marginTop: 14, color: 'var(--muted)', fontSize: 'var(--text-md)' }}>
                  <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} disabled={adding} />
                  Jadikan admin
                </label>
                <div className="form-actions" style={{ marginTop: 18 }}>
                  <button type="submit" className="btn btn-primary" disabled={adding || !email.trim()}>
                    {adding ? 'Menambahkan…' : 'Tambah member'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section>
            <div className="table-wrap">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Peran</th>
                    <th>Dibuat</th>
                    <th className="table-actions"><span className="visually-hidden">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Belum ada member.</td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.id}>
                        <td className="member-email">{m.email}</td>
                        <td>
                          <span className={`badge ${m.is_admin === 1 ? 'badge-warning' : 'badge-info'}`}>{m.is_admin === 1 ? 'Admin' : 'Member'}</span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                          {new Date(m.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td className="table-actions">
                          <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => handleDelete(m.id)} disabled={deleting === m.id}>
                            {deleting === m.id ? 'Menghapus…' : 'Hapus'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="settings-grid is-wide">
          <section className="card">
            <div className="card-body">
              <h2 className="card-title">Provider AI</h2>
              <p className="card-subtitle">Hanya admin yang dapat mengubah pengaturan ini.</p>
              <form onSubmit={handleSaveAi} style={{ marginTop: 16 }}>
                <div className="field">
                  <label className="field-label" htmlFor="ai-provider">Provider</label>
                  <select id="ai-provider" className="input" value={aiProvider} onChange={(e) => changeProvider(e.target.value as 'gemini' | 'nvidia')} disabled={savingAi}>
                    <option value="gemini">Google Gemini</option>
                    <option value="nvidia">NVIDIA</option>
                  </select>
                  <span className="hint">Default: {defaultModel}</span>
                </div>

                <div className="field" style={{ marginTop: 16 }}>
                  <label className="field-label" htmlFor="ai-key">API key</label>
                  <input id="ai-key" className="input" type="password" autoComplete="off" placeholder={aiProvider === 'nvidia' ? 'nvapi-…' : 'AIzaSy…'} value={aiKey} onChange={(e) => setAiKey(e.target.value)} disabled={savingAi} />
                  <span className="hint">
                    Disimpan terenkripsi di database. {aiProvider === 'nvidia' ? 'Key NVIDIA diawali nvapi-.' : 'Key Gemini dari Google AI Studio.'}
                    {aiSettings?.configured && <> Terkonfigurasi: {aiSettings.keyHint}</>}
                  </span>
                </div>

                <div className="field" style={{ marginTop: 16 }}>
                  <label className="field-label" htmlFor="ai-model">Model</label>
                  <select id="ai-model" className="input" value={aiModel} onChange={(e) => setAiModel(e.target.value)} disabled={savingAi}>
                    {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="hint">Default: {aiSettings?.defaultModel ?? defaultModel}</span>
                </div>

                <div className="form-actions" style={{ marginTop: 18 }}>
                  <button type="submit" className="btn btn-primary" disabled={savingAi}>
                    {savingAi ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {aiSettings && (
            <section className="card">
              <div className="card-body">
                <h2 className="card-title">Status AI</h2>
                <dl className="stat-list" style={{ marginTop: 16 }}>
                  <dt>Provider</dt><dd>{aiSettings.provider}</dd>
                  <dt>Terkonfigurasi</dt><dd>{aiSettings.configured ? 'Ya' : 'Belum'}</dd>
                  <dt>Sumber key</dt><dd>{aiSettings.source ?? '—'}</dd>
                  <dt>Model</dt><dd>{aiSettings.model}</dd>
                </dl>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
