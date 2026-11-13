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

  const { DB } = env;
  const chats = await DB.prepare(
    'SELECT id, name, created_by, created_at FROM chats ORDER BY created_at DESC'
  ).all();
  return new Response(JSON.stringify(chats.results || []), {
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

  const { name } = await context.request.json();
  const { DB } = env;
  const result = await DB.prepare(
    'INSERT INTO chats (name, created_by) VALUES (?, ?)'
  ).bind(name || null, session.email).run();

  const chat = await DB.prepare(
    'SELECT id, name, created_by, created_at FROM chats WHERE id = ?'
  ).bind(result.meta.last_row_id).first();

  return new Response(JSON.stringify(chat), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function validateSession(env, token) {
  const data = await env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data);
}