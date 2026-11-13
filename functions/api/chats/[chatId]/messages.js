export const onRequestGet = async (context) => {
  const { env } = context;
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const token = authHeader.substring(7);
  const session = await validateSession(env, token);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const chatId = context.params.chatId;
  const { DB } = env;
  const messages = await DB.prepare(
    'SELECT id, sender_email, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC'
  ).bind(chatId).all();
  return new Response(JSON.stringify(messages.results || []), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost = async (context) => {
  const { env } = context;
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const token = authHeader.substring(7);
  const session = await validateSession(env, token);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const chatId = context.params.chatId;
  const { content } = await context.request.json();
  if (!content) {
    return new Response(JSON.stringify({ error: 'Konten pesan kosong' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { DB } = env;
  const result = await DB.prepare(
    'INSERT INTO messages (chat_id, sender_email, content) VALUES (?, ?, ?)'
  ).bind(chatId, session.email, content).run();

  const message = await DB.prepare(
    'SELECT id, sender_email, content, created_at FROM messages WHERE id = ?'
  ).bind(result.meta.last_row_id).first();

  return new Response(JSON.stringify(message), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function validateSession(env, token) {
  const data = await env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data);
}