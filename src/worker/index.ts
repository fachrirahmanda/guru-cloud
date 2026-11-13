import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

export type AppEnv = { Bindings: Env; Variables: { user: { email: string; is_admin: boolean } } };

const app = new Hono<AppEnv>().basePath('/api');

// ============================================================
// Auth routes
// ============================================================

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

// Cookie sesi tidak bisa dibaca JavaScript (HttpOnly), jadi token hanya dikirim browser
// otomatis ke /api. Secure ikut dipasang di https (produksi), tidak di http localhost.
function sessionCookie(requestUrl: string, value: string, maxAge: number) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `session_token=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// Token sesi: cookie session_token (browser), atau header Authorization: Bearer (klien API).
function sessionToken(c: any): string | undefined {
  const bearer = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) return bearer;
  const cookie = c.req.header('cookie') ?? '';
  return cookie.match(/(?:^|;\s*)session_token=([^;]+)/)?.[1];
}

async function getSession(c: any) {
  const token = sessionToken(c);
  if (!token) return null;
  const data = await c.env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data) as { email: string; is_admin: boolean; createdAt: string };
}

async function requireUser(c: any, next: any) {
  const session = await getSession(c);
  if (!session) throw new HTTPException(401, { message: 'Unauthorized' });
  c.set('user', session);
  await next();
}

app.route('/auth', (() => {
  const auth = new Hono<AppEnv>();

  auth.get('/login', async (c) => {
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI || new URL('/api/auth/callback', c.req.url).toString();
    if (!clientId) {
      return c.json({ error: 'Google OAuth not configured' }, 500);
    }
    const state = crypto.randomUUID();
    const scope = 'openid email profile';
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);
    return Response.redirect(authUrl.toString(), 302);
  });

  auth.get('/callback', async (c) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (error) return new Response('OAuth error: ' + error, { status: 400 });
    if (!code) return new Response('Missing authorization code', { status: 400 });

    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI || new URL('/api/auth/callback', c.req.url).toString();

    if (!clientId || !clientSecret) {
      return c.json({ error: 'Google OAuth not configured' }, 500);
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text();
        return c.json({ error: 'Token exchange failed', detail: errorBody }, 400);
      }
      const tokens = await tokenRes.json();

      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + tokens.access_token },
      });
      if (!userRes.ok) {
        return c.json({ error: 'Failed to get user info' }, 400);
      }
      const googleUser = await userRes.json();
      const email = googleUser.email;

      if (!email || !email.endsWith('@gmail.com')) {
        return new Response(
          '<html><body><script>alert("Hanya akun Gmail yang diizinkan."); window.location.href="/";</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      const member = await c.env.DB.prepare(
        'SELECT id, email, is_admin FROM members WHERE email = ?'
      ).bind(email).first() as { id: number; email: string; is_admin: number } | null;

      if (!member) {
        return new Response(
          '<html><body><script>alert("Email Anda belum terdaftar. Hubungi admin untuk ditambahkan."); window.location.href="/";</script></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      const sessionToken = crypto.randomUUID();
      const sessionData = JSON.stringify({
        email: member.email,
        is_admin: member.is_admin === 1,
        createdAt: new Date().toISOString(),
      });
      await c.env.SESSIONS.put('session:' + sessionToken, sessionData, {
        expirationTtl: 7 * 24 * 60 * 60,
      });

      const response = new Response(null, {
        status: 302,
        headers: {
          Location: '/chat',
          'Set-Cookie': sessionCookie(c.req.url, sessionToken, SESSION_TTL_SECONDS),
        },
      });
      return response;
    } catch (e) {
      console.error('Auth error:', e);
      return c.json({ error: 'Authentication failed', detail: String(e) }, 500);
    }
  });

  auth.post('/logout', async (c) => {
    const token = sessionToken(c);
    if (token) await c.env.SESSIONS.delete('session:' + token);
    const response = c.json({ ok: true });
    response.headers.set('Set-Cookie', sessionCookie(c.req.url, '', 0));
    return response;
  });

  // Dibaca frontend untuk menentukan apakah tombol dev login ditampilkan.
  auth.get('/config', (c) => {
    const host = new URL(c.req.url).hostname;
    const devLogin = c.env.DEV_LOGIN === 'true' && (host === 'localhost' || host === '127.0.0.1');
    return c.json({ devLogin });
  });

  // Dev-only: bypass Google OAuth for local testing. Hanya aktif jika DEV_LOGIN=true
  // (di .dev.vars) dan diakses dari localhost; di produksi endpoint ini menjawab 404.
  auth.post('/dev-login', async (c) => {
    const host = new URL(c.req.url).hostname;
    if (c.env.DEV_LOGIN !== 'true' || (host !== 'localhost' && host !== '127.0.0.1')) {
      return c.json({ error: 'Not found' }, 404);
    }

    const { email } = await c.req.json<{ email?: string }>();
    const devEmail = (email?.trim() || 'dev@gmail.com').toLowerCase();
    if (!devEmail.endsWith('@gmail.com')) {
      return c.json({ error: 'Dev email must be a Gmail address' }, 400);
    }

    const sessionToken = crypto.randomUUID();
    const sessionData = JSON.stringify({
      email: devEmail,
      is_admin: true,
      createdAt: new Date().toISOString(),
    });
    await c.env.SESSIONS.put('session:' + sessionToken, sessionData, {
      expirationTtl: 7 * 24 * 60 * 60,
    });

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: '/chat',
        'Set-Cookie': sessionCookie(c.req.url, sessionToken, SESSION_TTL_SECONDS),
      },
    });
    return response;
  });

  auth.get('/me', requireUser, async (c) => {
    const session = c.get('user') as { email: string; is_admin: boolean };
    return c.json({
      email: session.email,
      is_admin: Boolean(session.is_admin),
    });
  });

  return auth;
})());

// ============================================================
// Ask AI (Gemini) routes
// ============================================================

const DEFAULT_MODEL = 'gemini-flash-latest';
const NVIDIA_DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const KEY_INFO = 'guru-ai-key';
const ANSWER_TIMEOUT = 12_000;
const IMAGE_TIMEOUT = 30_000;
const FULL_IMAGE_TIMEOUT = 60_000;
const NVIDIA_TIMEOUT = 150_000;
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const DAILY_LIMIT = 50;
const HISTORY_DAYS = 90;
const HISTORY_PAGE = 30;
const MAX_KEYS = 60;
const MAX_ACTIONS = 30;
const AI_IMAGE_MAX = 6;
const FILE_TEXT_MAX = 150_000;

type AiEnv = Env & {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_BASE_URL?: string;
  SETTINGS_KEY?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_MODEL?: string;
};

const isNvidia = (key: string) => key.startsWith('nvapi-');

const base = (env: Env) => (env as AiEnv).GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

class GeminiTimeout extends Error {}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const RETRY_STATUSES = [404, 429, 500, 502, 503, 504];

function cleanFile(raw: unknown): { name: string; text?: string; pdf?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as { name?: string; text?: string; pdf?: string };
  const name = String(f.name ?? 'file').slice(0, 200);
  if (typeof f.pdf === 'string' && f.pdf) {
    if (!/^[A-Za-z0-9+/=]+$/.test(f.pdf.slice(0, 200))) throw new HTTPException(400, { message: "The PDF couldn't be read" });
    if (f.pdf.length > 14_000_000) throw new HTTPException(400, { message: 'PDFs can be up to 10 MB' });
    return { name, pdf: f.pdf };
  }
  if (typeof f.text === 'string' && f.text.trim()) {
    if (f.text.length > FILE_TEXT_MAX) throw new HTTPException(400, { message: 'This file is too large to ask about' });
    return { name, text: f.text };
  }
  return null;
}

function cleanImages(raw: unknown): { mimeType: string; data: string }[] {
  const images = (Array.isArray(raw) ? raw : []).slice(0, AI_IMAGE_MAX) as { mimeType?: string; data?: string }[];
  for (const img of images) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(String(img?.mimeType)) || typeof img.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(img.data.slice(0, 200))) {
      throw new HTTPException(400, { message: 'Attach PNG, JPEG, WebP or GIF images' });
    }
    if (img.data.length > 6_000_000) throw new HTTPException(400, { message: 'Images can be up to about 4 MB each' });
  }
  return images.map((img) => ({ mimeType: img.mimeType!, data: img.data! }));
}

async function gemini(env: Env, path: string, apiKey: string, body?: unknown, timeoutMs = ANSWER_TIMEOUT) {
  const url = `${base(env)}${path}`;
  const init = {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  const call = (env as AiEnv).GEMINI_BASE_URL
    ? fetch(url, init)
    : fetch(url, init);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new GeminiTimeout()), timeoutMs)));
  try {
    return await Promise.race([call, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function nvidia(env: Env, apiKey: string, model: string, question: string, history: { question: string; answer: string }[], images: { mimeType: string; data: string }[], file: { name: string; text?: string; pdf?: string } | null) {
  const SYSTEM = `You are "Ask AI", a helpful assistant for Guru. Answer questions concisely and helpfully.
- Answer in the language of the user's question (Indonesian or English).
- Plain text only. Short "- " bullets are fine; no tables, no markdown headings or bold.
- Images or one file (a spreadsheet as text, or a PDF) can come with the question: read them and answer based on their content.
- If nothing matches or you don't know, say so.`;

  const now_ = `Today: ${new Date().toISOString().slice(0, 10)}.`;

  const context = [
    `Question context: Guru AI assistant.`,
    `Values for actions: none (this is a general assistant).`,
    '',
    now_,
  ].join('\n');

  const messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] = [
    { role: 'system', content: `${SYSTEM}\n\n${context}\n\n${now_}` },
  ];

  for (const t of history) {
    messages.push({ role: 'user', content: t.question });
    messages.push({ role: 'assistant', content: t.answer });
  }

  const userContent: { type: string; text?: string; image_url?: { url: string } }[] = [];
  for (const img of images) {
    userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }
  if (file?.pdf) {
    userContent.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${file.pdf}` } });
  }
  if (file?.text) {
    userContent.push({ type: 'text', text: `Attached file "${file.name}":\n${file.text}` });
  }
  userContent.push({ type: 'text', text: question });
  messages.push({ role: 'user', content: userContent });

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
    stream: false,
  });

  const url = `${NVIDIA_BASE}/chat/completions`;
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey },
    body,
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error('nvidia timeout')), NVIDIA_TIMEOUT)));
  try {
    return await Promise.race([fetch(url, init), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function aiConfig(env: Env) {
  // Check DB settings first (admin-configured via Settings page), fall back to env secrets
  const settingsKey = (env as AiEnv).SETTINGS_KEY || (env as Env).GOOGLE_CLIENT_SECRET || '';
  let dbKey: string | null = null;
  let dbModel: string | null = null;
  let dbProvider: 'gemini' | 'nvidia' | null = null;
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM app_settings WHERE key IN ('ai.key', 'ai.model', 'ai.provider')"
    ).all<{ key: string; value: string }>();
    const settings = Object.fromEntries(results.map((r: { key: string; value: string }) => [r.key.slice('ai.'.length), r.value]));
    if (settings.key) {
      try {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(settingsKey), 'HKDF', false, ['deriveKey']);
        const cryptoKey = await crypto.subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('guru-ai'), info: new TextEncoder().encode(KEY_INFO) },
          material,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt'],
        );
        // settings sudah berbentuk { key: <terenkripsi>, model, provider }, jadi ambil settings.key.
        const out = base64ToBytes(settings.key);
        const iv = out.slice(0, 12);
        const data = out.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
        dbKey = new TextDecoder().decode(decrypted);
      } catch {
        dbKey = null;
      }
    }
    dbModel = settings.model || null;
    dbProvider = settings.provider === 'nvidia' ? 'nvidia' : 'gemini';
  } catch {
    // DB may not be migrated yet; fall back to env secrets
  }

  const envKey = (env as AiEnv).GEMINI_API_KEY ?? (env as AiEnv).NVIDIA_API_KEY ?? null;
  if (!dbKey && !envKey) return null;

  if (dbKey) {
    const provider = dbProvider || (isNvidia(dbKey) ? 'nvidia' : 'gemini');
    return { key: dbKey, model: dbModel || (provider === 'nvidia' ? NVIDIA_DEFAULT_MODEL : DEFAULT_MODEL), source: 'settings' as const, provider };
  }

  // Env secret fallback
  const key = envKey!;
  if (isNvidia(key)) {
    return { key, model: (env as AiEnv).NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL, source: 'secret' as const, provider: 'nvidia' as const };
  }
  return { key, model: (env as AiEnv).GEMINI_MODEL || DEFAULT_MODEL, source: 'secret' as const, provider: 'gemini' as const };
}

async function askAi(env: Env, config: { key: string; model: string; provider: 'gemini' | 'nvidia' }, question: string, history: { question: string; answer: string }[], images: { mimeType: string; data: string }[], file: { name: string; text?: string; pdf?: string } | null) {
  const SYSTEM = `You are "Ask AI", a helpful assistant for Guru. Answer questions concisely and helpfully.
- Answer in the language of the user's question (Indonesian or English).
- Plain text only. Short "- " bullets are fine; no tables, no markdown headings or bold.
- Images or one file (a spreadsheet as text, or a PDF) can come with the question: read them and answer based on their content.
- If nothing matches or you don't know, say so.`;

  const now_ = `Today: ${new Date().toISOString().slice(0, 10)}.`;

  const data = [
    `Question context: Guru AI assistant.`,
    `Values for actions: none (this is a general assistant).`,
    '',
    now_,
  ].join('\n');

  if (config.provider === 'nvidia') {
    const res = await nvidia(env, config.key, config.model, question, history, images, file);
    if (!res.ok) {
      let message = `NVIDIA didn't answer (${res.status}). Try again.`;
      if (res.status === 429) message = 'NVIDIA rate limit reached. Try again in a minute.';
      else if (res.status === 400 || res.status === 403) message = `NVIDIA refused the request: check the API key and model.`;
      else if (res.status === 404) message = `No NVIDIA model answered.`;
      throw new HTTPException(502, { message });
    }
    const out = await res.json();
    const text = (out as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '';
    return {
      answer: text.trim(),
      keys: [],
      actions: [],
      remaining: Math.max(0, DAILY_LIMIT - 1),
    };
  }

  const ask = (model: string, thinking: boolean) => gemini(env, `/models/${encodeURIComponent(model)}:generateContent`, config.key, {
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${data}\n\n${now_}` }] },
    contents: [
      ...history.flatMap((t) => [
        { role: 'user', parts: [{ text: t.question }] },
        { role: 'model', parts: [{ text: JSON.stringify({ answer: t.answer, keys: [] }) }] },
      ]),
      {
        role: 'user',
        parts: [
          ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          ...(file?.pdf ? [{ inlineData: { mimeType: 'application/pdf', data: file.pdf } }] : []),
          ...(file?.text ? [{ text: `Attached file "${file.name}":\n${file.text}` }] : []),
          { text: question },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      ...(thinking ? { thinkingConfig: { thinkingBudget: 512 } } : {}),
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          answer: { type: 'STRING' },
          keys: { type: 'ARRAY', items: { type: 'STRING' } },
          actions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { key: { type: 'STRING' }, field: { type: 'STRING' }, to: { type: 'STRING' }, reason: { type: 'STRING' } },
              required: ['key', 'field', 'to'],
            },
          },
        },
        required: ['answer', 'keys'],
      },
    },
  }, images.length || file ? (file ? FULL_IMAGE_TIMEOUT : IMAGE_TIMEOUT) : ANSWER_TIMEOUT);

  const models = [config.model, ...FALLBACK_MODELS.filter((m) => m !== config.model)];
  let res: Response | null = null;
  const tried: string[] = [];

  for (const model of models) {
    try {
      res = await ask(model, true);
      if (res.status === 400 && /thinking/i.test(await res.clone().text())) {
        res = await ask(model, false);
      }
    } catch (err: unknown) {
      if (!(err instanceof GeminiTimeout)) throw err;
      tried.push(`${model}: slow`);
      res = null;
      continue;
    }
    if (res.ok || !RETRY_STATUSES.includes(res.status)) break;
    tried.push(`${model}: ${res.status}`);
  }

  if (res?.status === 429) {
    const text = await res.clone().text();
    let delay = null;
    try {
      const details = (JSON.parse(text) as { error?: { details?: { retryDelay?: string }[] } }).error?.details ?? [];
      delay = Number(details.find((d) => d.retryDelay)?.retryDelay?.replace(/s$/, '')) || null;
    } catch {}
    if (delay !== null && delay <= 20) {
      await new Promise((r) => setTimeout(r, delay * 1000 + 500));
      tried.push(`waited ${delay}s`);
      try {
        res = await ask(config.model, true);
      } catch (err: unknown) {
        if (!(err instanceof GeminiTimeout)) throw err;
      }
    }
  }

  if (!res) throw new HTTPException(504, { message: 'Gemini is busy or slow right now. Try again in a minute.' });
  if (!res.ok) {
    let message = `Gemini didn't answer (${res.status}). Try again.`;
    if (res.status === 429) message = 'Gemini rate limit reached. Try again in a minute.';
    else if (res.status === 400 || res.status === 403) message = `Gemini refused the request: check the API key and model.`;
    else if (res.status === 404) message = `No Gemini model answered (${tried.join(', ')}).`;
    throw new HTTPException(502, { message });
  }

  const out = await res.json();
  const candidates = (out as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] }).candidates;
  const text = candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
  let parsed: { answer?: unknown; keys?: unknown; actions?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('gemini returned non-JSON', text.slice(0, 300));
    throw new HTTPException(502, { message: "The AI's answer couldn't be read. Try asking again." });
  }

  const answer: { answer: string; keys: string[]; actions: { key: string; field: string; to: string; reason: string }[]; remaining: number } = {
    answer: typeof parsed.answer === 'string' ? parsed.answer.trim() : '',
    keys: Array.isArray(parsed.keys) ? parsed.keys.slice(0, MAX_KEYS).map((k) => String(k).trim().toUpperCase()) : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, MAX_ACTIONS).map((a) => ({
      key: String(a?.key ?? '').trim(),
      field: String(a?.field ?? '').trim(),
      to: String(a?.to ?? '').trim(),
      reason: String(a?.reason ?? '').trim().slice(0, 160),
    })) : [],
    remaining: Math.max(0, DAILY_LIMIT - 1),
  };

  return answer;
}

// ============================================================
// Ask AI: ask endpoint
// ============================================================

app.post('/ai/ask', requireUser, async (c) => {
  const config = await aiConfig(c.env);
  if (!config) throw new HTTPException(503, { message: 'Ask AI is not set up yet. An admin can add an API key under Settings → AI.' });

  const user = c.get('user') as { email: string; is_admin: boolean };
  const body = await c.req.json<{ question?: string; history?: { question: string; answer: string }[]; images?: { mimeType: string; data: string }[]; file?: { name: string; text?: string; pdf?: string }; projectId?: string | null }>();

  const file = cleanFile(body.file);
  const question = body.question?.trim() || (file ? 'Read the attached file and summarize what it shows.' : '');
  const images = cleanImages(body.images);
  const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : null;
  if (!question) throw new HTTPException(400, { message: 'Type a question or attach a file' });
  if (question.length > 500) throw new HTTPException(400, { message: 'Keep it under 500 characters' });

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-3)
    .filter((t) => typeof t?.question === 'string' && typeof t?.answer === 'string')
    .map((t) => ({ question: t.question.slice(0, 500), answer: t.answer.slice(0, 1500) }));

  // Daily limit
  const day = new Date().toISOString().slice(0, 10);
  const usage = await c.env.DB.prepare(
    'INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1 RETURNING count'
  ).bind(user.email, day).first<{ count: number }>();
  if ((usage?.count ?? 0) > DAILY_LIMIT) throw new HTTPException(429, { message: `You've reached today's limit of ${DAILY_LIMIT} questions. It resets tomorrow.` });

  const answer = await askAi(c.env, config, question, history, images, file);

  const t = Date.now();
  const questionId = crypto.randomUUID();
  c.executionCtx.waitUntil(
    c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO ai_questions (id, user_id, question, answer, keys, created_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(questionId, user.email, question, answer.answer, JSON.stringify(answer.keys), t, projectId),
      c.env.DB.prepare('DELETE FROM ai_questions WHERE user_id = ? AND created_at < ?').bind(user.email, t - HISTORY_DAYS * 86_400_000),
    ]).then(() => undefined, (err: unknown) => console.error('ai history', err)),
  );

  return c.json({ ...answer, id: questionId });
});

// ============================================================
// Ask AI: history endpoint
// ============================================================

type QuestionRow = { id: string; question: string; answer: string; keys: string; created_at: number; project_id: string | null; pinned: number };

const questionItem = (r: QuestionRow) => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  keys: JSON.parse(r.keys || '[]') as string[],
  createdAt: r.created_at,
  projectId: r.project_id,
  pinned: r.pinned === 1,
});

/** Riwayat, dengan pencarian (q), filter project (project = id, atau "none" untuk tanpa project), dan pinned=1. */
app.get('/ai/history', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? String(HISTORY_PAGE), 10)), 100);
  const offset = (page - 1) * limit;
  const q = (c.req.query('q') ?? '').trim().slice(0, 200);
  const project = c.req.query('project') ?? '';
  const pinnedOnly = c.req.query('pinned') === '1';

  const where = ['user_id = ?'];
  const binds: (string | number)[] = [user.email];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => '\\' + ch)}%`;
    where.push("(question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\')");
    binds.push(like, like);
  }
  if (project === 'none') where.push('project_id IS NULL');
  else if (project) {
    where.push('project_id = ?');
    binds.push(project);
  }
  if (pinnedOnly) where.push('pinned = 1');
  const whereSql = where.join(' AND ');

  const { results } = await c.env.DB.prepare(
    `SELECT id, question, answer, keys, created_at, project_id, pinned FROM ai_questions WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all<QuestionRow>();

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM ai_questions WHERE ${whereSql}`
  ).bind(...binds).first<{ cnt: number }>();

  return c.json({
    items: results.map(questionItem),
    hasMore: (countRow?.cnt ?? 0) > offset + results.length,
  });
});

app.get('/ai/questions/:id', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const row = await c.env.DB.prepare(
    'SELECT id, question, answer, keys, created_at, project_id, pinned FROM ai_questions WHERE id = ? AND user_id = ?'
  ).bind(c.req.param('id'), user.email).first<QuestionRow>();
  if (!row) throw new HTTPException(404, { message: 'Not found' });
  return c.json(questionItem(row));
});

/** Pin atau pindah project untuk satu pertanyaan. projectId null = keluarkan dari project. */
app.patch('/ai/questions/:id', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const body = await c.req.json<{ pinned?: boolean; projectId?: string | null }>();
  const id = c.req.param('id');
  if (typeof body.pinned === 'boolean') {
    await c.env.DB.prepare('UPDATE ai_questions SET pinned = ? WHERE id = ? AND user_id = ?').bind(body.pinned ? 1 : 0, id, user.email).run();
  }
  if (body.projectId !== undefined) {
    if (body.projectId !== null) {
      const owned = await c.env.DB.prepare('SELECT id FROM ai_projects WHERE id = ? AND user_id = ?').bind(body.projectId, user.email).first();
      if (!owned) throw new HTTPException(404, { message: 'Project not found' });
    }
    await c.env.DB.prepare('UPDATE ai_questions SET project_id = ? WHERE id = ? AND user_id = ?').bind(body.projectId, id, user.email).run();
  }
  return c.json({ ok: true });
});

app.delete('/ai/questions/:id', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  await c.env.DB.prepare('DELETE FROM ai_questions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.email).run();
  return c.json({ ok: true });
});

app.get('/ai/projects', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.created_at, COUNT(q.id) AS count
       FROM ai_projects p LEFT JOIN ai_questions q ON q.project_id = p.id AND q.user_id = p.user_id
      WHERE p.user_id = ? GROUP BY p.id ORDER BY p.created_at ASC`
  ).bind(user.email).all<{ id: string; name: string; created_at: number; count: number }>();
  return c.json({ items: results.map((r: { id: string; name: string; created_at: number; count: number }) => ({ id: r.id, name: r.name, createdAt: r.created_at, count: r.count })) });
});

app.post('/ai/projects', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const { name } = await c.req.json<{ name?: string }>();
  const clean = (name ?? '').trim().slice(0, 80);
  if (!clean) throw new HTTPException(400, { message: 'Project name is required' });
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO ai_projects (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id, user.email, clean, Date.now()).run();
  return c.json({ id, name: clean });
});

app.patch('/ai/projects/:id', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const { name } = await c.req.json<{ name?: string }>();
  const clean = (name ?? '').trim().slice(0, 80);
  if (!clean) throw new HTTPException(400, { message: 'Project name is required' });
  await c.env.DB.prepare('UPDATE ai_projects SET name = ? WHERE id = ? AND user_id = ?').bind(clean, c.req.param('id'), user.email).run();
  return c.json({ ok: true });
});

app.delete('/ai/projects/:id', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const id = c.req.param('id');
  // Pertanyaan di dalamnya tidak ikut terhapus, hanya lepas dari project.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE ai_questions SET project_id = NULL WHERE project_id = ? AND user_id = ?').bind(id, user.email),
    c.env.DB.prepare('DELETE FROM ai_projects WHERE id = ? AND user_id = ?').bind(id, user.email),
  ]);
  return c.json({ ok: true });
});

// ============================================================
// Ask AI: settings endpoint (admin only)
// ============================================================

app.get('/ai/settings', requireUser, async (c) => {
  const user = c.get('user') as { email: string; is_admin: boolean };
  if (!user.is_admin) throw new HTTPException(403, { message: 'Admin required' });

  const { results } = await c.env.DB.prepare(
    "SELECT key, value FROM app_settings WHERE key LIKE 'ai.%'"
  ).all<{ key: string; value: string }>();
  const settings = Object.fromEntries(results.map((r: { key: string; value: string }) => [r.key.slice('ai.'.length), r.value]));
  const configured = !!settings.key;
  const keyHint = configured ? '…' + settings.key.slice(-4) : null;

  // Provider yang disimpan admin menang. Tebak dari key hanya untuk data lama (sebelum ai.provider ada).
  let provider: 'gemini' | 'nvidia' = 'gemini';
  if (settings.provider === 'nvidia' || settings.provider === 'gemini') provider = settings.provider;
  else if (settings.key) {
    try {
      const secret = (c.env as AiEnv).SETTINGS_KEY || c.env.GOOGLE_CLIENT_SECRET || '';
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
      const cryptoKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('guru-ai'), info: new TextEncoder().encode(KEY_INFO) },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );
      const out = base64ToBytes(settings.key);
      const iv = out.slice(0, 12);
      const data = out.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
      const keyStr = new TextDecoder().decode(decrypted);
      if (keyStr.startsWith('nvapi-')) provider = 'nvidia';
    } catch {}
  }

  return c.json({
    provider,
    configured,
    source: configured ? ('settings' as const) : ('secret' as const),
    keyHint,
    model: settings.model || (provider === 'nvidia' ? (c.env as AiEnv).NVIDIA_MODEL || NVIDIA_DEFAULT_MODEL : (c.env as AiEnv).GEMINI_MODEL || DEFAULT_MODEL),
    defaultModel: provider === 'nvidia' ? NVIDIA_DEFAULT_MODEL : DEFAULT_MODEL,
  });
});

app.post('/ai/settings', requireUser, async (c) => {
  const user = c.get('user') as { email: string; is_admin: boolean };
  if (!user.is_admin) throw new HTTPException(403, { message: 'Admin required' });

  const { key, model, provider } = await c.req.json<{ key?: string; model?: string; provider?: 'gemini' | 'nvidia' }>();

  if (key) {
    // Encrypt and store
    const secret = (c.env as AiEnv).SETTINGS_KEY || c.env.GOOGLE_CLIENT_SECRET || '';
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'HKDF', false, ['deriveKey']);
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('guru-ai'), info: new TextEncoder().encode(KEY_INFO) },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(key)));
    const out = new Uint8Array(iv.length + data.length);
    out.set(iv);
    out.set(data, iv.length);
    const encrypted = btoa(String.fromCharCode(...out));

    await c.env.DB.prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind('ai.key', encrypted, new Date().toISOString()).run();
  }

  // Provider disimpan sendiri, jadi bisa diganti tanpa mengisi key baru.
  if (provider === 'gemini' || provider === 'nvidia') {
    await c.env.DB.prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind('ai.provider', provider, new Date().toISOString()).run();
  }

  if (model) {
    await c.env.DB.prepare(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind('ai.model', model, new Date().toISOString()).run();
  }

  return c.json({ ok: true });
});

// ============================================================
// Ask AI: status endpoint
// ============================================================

app.get('/ai/status', requireUser, async (c) => {
  const user = c.get('user') as { email: string };
  const day = new Date().toISOString().slice(0, 10);
  const usage = await c.env.DB.prepare(
    'SELECT count FROM ai_usage WHERE user_id = ? AND day = ?'
  ).bind(user.email, day).first<{ count: number }>();

  return c.json({
    used: usage?.count ?? 0,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - (usage?.count ?? 0)),
  });
});

export default {
  fetch: app.fetch,
};
