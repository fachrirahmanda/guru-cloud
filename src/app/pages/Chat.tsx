import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { useApi, api } from '../api';
import { Icon } from '../components/ui';
import { Select } from '../components/Select';
import { useHistory, type AiProject, type HistoryItem } from '../history';
import type { AiImage, AiFile, AiAnswer } from '../../shared/types';

type Usage = { used: number };
type Turn = { question: string; answer: string; keys: string[]; actions: { key: string; to: string }[] };
type ConversationDetail = {
  id: string;
  projectId: string | null;
  pinned: boolean;
  turns: { question: string; answer: string; keys: string[]; createdAt: number }[];
};

export function Chat() {
  // /chat/:id membuka satu pertanyaan tersimpan. /, /chat, dan ?project=… adalah chat baru.
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get('project');
  const { bump } = useHistory();
  // location.key berubah di setiap navigasi, termasuk klik "Chat baru" saat sudah di "/".
  const { key: navKey } = useLocation();

  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [current, setCurrent] = useState<HistoryItem | null>(null);
  const [images, setImages] = useState<AiImage[]>([]);
  const [file, setFile] = useState<AiFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: usage, reload: reloadUsage } = useApi<Usage>('/api/ai/status');
  const { data: projectList, reload: reloadProjects } = useApi<{ items: AiProject[] }>('/api/ai/projects');

  // Muat pertanyaan yang dibuka dari sidebar; ganti chat baru = kosongkan layar.
  useEffect(() => {
    setError(null);
    if (!id) {
      setTurns([]);
      setCurrent(null);
      return;
    }
    let alive = true;
    setOpening(true);
    api<ConversationDetail>(`/api/ai/conversations/${id}`)
      .then((conv) => {
        if (!alive) return;
        const first = conv.turns[0];
        setCurrent({ id: conv.id, question: first.question, createdAt: first.createdAt, projectId: conv.projectId, pinned: conv.pinned, turns: conv.turns.length });
        setTurns(conv.turns.map((t) => ({ question: t.question, answer: t.answer, keys: t.keys, actions: [] })));
      })
      .catch(() => alive && setError('Pertanyaan ini tidak ditemukan.'))
      .finally(() => alive && setOpening(false));
    return () => { alive = false; };
  }, [id, navKey]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loading, error]);

  // Satu jalur untuk semua lampiran: tombol lampiran, Ctrl+V, dan tombol Tempel.
  const attachFile = (f: File) => {
    if (f.type !== 'application/pdf' && !f.type.startsWith('image/')) {
      setError('Hanya gambar (JPG, PNG, WebP, GIF) dan PDF yang bisa dilampirkan.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = (reader.result as string).split(',')[1];
      if (f.type === 'application/pdf') {
        setFile({ name: f.name, pdf: data });
      } else {
        setImages((prev) => [...prev, { mimeType: f.type, data }]);
      }
    };
    reader.readAsDataURL(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) attachFile(f);
  };

  // Ctrl+V: gambar atau PDF yang disalin (screenshot, file dari explorer) dilampirkan.
  // Teks biasa dibiarkan masuk ke kolom seperti biasa.
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    files.forEach(attachFile);
  };

  // Tombol Tempel: membaca clipboard langsung (butuh izin browser; di localhost/https).
  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      setError('Browser ini tidak mengizinkan membaca clipboard. Gunakan Ctrl+V di kolom pertanyaan.');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      let attached = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          attachFile(new File([blob], `clipboard.${imageType.split('/')[1] ?? 'png'}`, { type: imageType }));
          attached = true;
        } else if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text();
          setQuestion((q) => (q ? `${q} ${text}` : text));
        }
      }
      if (!attached && items.length === 0) setError('Clipboard kosong.');
    } catch {
      setError('Clipboard tidak bisa dibaca. Coba Ctrl+V di kolom pertanyaan.');
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const canSend = !loading && !opening && (question.trim() !== '' || file !== null || images.length > 0);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const asked = question.trim();
    setLoading(true);
    setError(null);
    try {
      const res = await api<AiAnswer & { id: string; conversationId: string }>('/api/ai/ask', {
        method: 'POST',
        body: {
          question: asked,
          history: turns.map((t) => ({ question: t.question, answer: t.answer })),
          images,
          file,
          conversationId: current?.id ?? null,
          projectId: current?.projectId ?? projectParam,
        },
      });
      setTurns((prev) => [...prev, { question: asked, answer: res.answer, keys: res.keys, actions: res.actions }]);
      if (!current) setCurrent({ id: res.conversationId, question: asked, createdAt: Date.now(), projectId: projectParam, pinned: false, turns: 1 });
      else setCurrent({ ...current, turns: current.turns + 1 });
      setQuestion('');
      setImages([]);
      setFile(null);
      reloadUsage();
      bump();
    } catch (err: any) {
      setError(err.message || 'Gagal mendapatkan jawaban.');
    } finally {
      setLoading(false);
    }
  };

  // Pin dan pindah project untuk pertanyaan yang sedang dibuka.
  const togglePin = async () => {
    if (!current) return;
    const pinned = !current.pinned;
    await api(`/api/ai/conversations/${current.id}`, { method: 'PATCH', body: { pinned } }).catch(() => {});
    setCurrent({ ...current, pinned });
    bump();
  };

  const moveToProject = async (projectId: string) => {
    if (!current) return;
    const next = projectId || null;
    await api(`/api/ai/conversations/${current.id}`, { method: 'PATCH', body: { projectId: next } }).catch(() => {});
    setCurrent({ ...current, projectId: next });
    reloadProjects();
    bump();
  };

  const title = current ? current.question : 'Tanya Guru AI';

  return (
    <div className="chat-layout">
      <aside className="chat-aside">
        <div className="card usage-card card-body">
          <span className="field-label">Pemakaian hari ini</span>
          {usage ? (
            <>
              <span className="num">{usage.used} <span className="hint">pertanyaan hari ini</span></span>
            </>
          ) : (
            <span className="hint">Memuat…</span>
          )}
        </div>

        <div className="card card-body">
          <span className="field-label">Tips</span>
          <ul className="hint" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Tanyakan dengan kalimat yang lengkap.</li>
            <li>Lampirkan gambar (JPG, PNG, WebP) atau PDF untuk dianalisis.</li>
          </ul>
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-panel">
          <header className="chat-head">
            <span className="chat-head-icon"><Icon name="sparkle" size={18} /></span>
            <div className="chat-head-text">
              <h2 className="truncate" title={title}>{title}</h2>
              <p>{current ? 'Pertanyaan tersimpan di riwayat.' : 'Ajukan apa saja, atau lampirkan file untuk dianalisis.'}</p>
            </div>
            {current && (
              <div className="chat-head-actions">
                <div className="chat-project-select">
                  <Select<string>
                    ariaLabel="Project"
                    searchable
                    value={current.projectId ?? ''}
                    options={[
                      { value: '', label: 'Tanpa project', icon: <Icon name="folder" size={14} /> },
                      ...(projectList?.items ?? []).map((p) => ({ value: p.id, label: p.name, icon: <Icon name="folder" size={14} /> })),
                    ]}
                    onChange={(v) => moveToProject(v ?? '')}
                    placeholder="Tanpa project"
                  />
                </div>
                <button type="button" className={`icon-btn icon-btn-sm${current.pinned ? ' is-on' : ''}`} onClick={togglePin} aria-label={current.pinned ? 'Lepas pin' : 'Pin'} title={current.pinned ? 'Lepas pin' : 'Pin'}>
                  <Icon name="pin" size={14} />
                </button>
              </div>
            )}
          </header>

          <div className="messages">
            {turns.length === 0 && !loading && !error && !opening && (
              <div className="messages-empty">
                <strong>Mulai percakapan</strong>
                Ketik pertanyaan di bawah, atau lampirkan gambar atau PDF.
              </div>
            )}

            {turns.map((turn, i) => (
              <Fragment key={i}>
                <div className="msg-row is-user">
                  <div className="msg-bubble">{turn.question}</div>
                </div>
                <div className="msg-row is-ai">
                  <div className="msg-bubble">
                    {turn.answer}
                    {turn.keys.length > 0 && <span className="msg-meta">Terkait: {turn.keys.join(', ')}</span>}
                    {turn.actions.length > 0 && (
                      <span className="msg-meta">Usulan perubahan: {turn.actions.map((a) => `${a.key} → ${a.to}`).join(', ')}</span>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}

            {loading && (
              <div className="msg-row is-ai">
                <div className="msg-bubble" aria-live="polite" aria-label="Guru AI sedang mengetik">
                  <span className="msg-typing"><span /><span /><span /></span>
                </div>
              </div>
            )}

            {error && (
              <div className="msg-row is-error" role="alert">
                <div className="msg-bubble">{error}</div>
              </div>
            )}

            <div ref={messagesEnd} />
          </div>

          <form className="composer" onSubmit={handleAsk}>
            {(images.length > 0 || file) && (
              <div className="composer-attachments">
                {images.map((img, i) => (
                  <div key={i} className="composer-thumb">
                    <img src={`data:${img.mimeType};base64,${img.data}`} alt="" />
                    <button type="button" onClick={() => removeImage(i)} aria-label="Hapus gambar">×</button>
                  </div>
                ))}
                {file && (
                  <span className="chip">
                    <Icon name="folder" size={14} />
                    <span className="truncate" style={{ maxWidth: 160 }}>{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} aria-label="Hapus file" style={{ border: 0, background: 'none', color: 'inherit', padding: 0, cursor: 'pointer' }}>×</button>
                  </span>
                )}
              </div>
            )}

            <div className="composer-row">
              <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" onChange={handleFileChange} hidden />
              <button type="button" className="icon-btn" onClick={() => fileInput.current?.click()} disabled={loading} aria-label="Lampirkan file" title="Lampirkan gambar atau PDF">
                <Icon name="attachment" size={16} />
              </button>
              <button type="button" className="icon-btn" onClick={pasteFromClipboard} disabled={loading} aria-label="Tempel dari clipboard" title="Tempel dari clipboard">
                <Icon name="clipboard" size={16} />
              </button>
              <input
                className="input"
                type="text"
                placeholder="Ketik pertanyaan Anda…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
                onPaste={handlePaste}
                aria-label="Pertanyaan"
              />
              <button type="submit" className="btn btn-primary" disabled={!canSend}>
                <Icon name="send" size={14} />
                {loading ? 'Mengirim…' : 'Kirim'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
