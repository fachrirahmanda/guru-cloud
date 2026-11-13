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
  const members = await DB.prepare('SELECT id, email, is_admin, created_at FROM members ORDER BY created_at DESC').all();
  return new Response(JSON.stringify(members.results || []), {
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
  if (!session || !session.is_admin) {
    return new Response(JSON.stringify({ error: 'Admin required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, is_admin } = await context.request.json();
  if (!email || !email.endsWith('@gmail.com')) {
    return new Response(JSON.stringify({ error: 'Hanya Gmail yang diizinkan' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { DB } = env;
  try {
    const result = await DB.prepare(
      'INSERT INTO members (email, is_admin) VALUES (?, ?)'
    ).bind(email, is_admin ? 1 : 0).run();
    return new Response(JSON.stringify({ id: result.meta.last_row_id, email, is_admin: is_admin ? 1 : 0 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'Email sudah terdaftar' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    throw e;
  }
};

async function validateSession(env, token) {
  const data = await env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data);
}