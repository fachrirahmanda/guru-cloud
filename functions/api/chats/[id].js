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

  const id = context.params.id;
  const { DB } = env;
  const chat = await DB.prepare(
    'SELECT id, name, created_by, created_at FROM chats WHERE id = ?'
  ).bind(id).first();

  if (!chat) {
    return new Response(JSON.stringify({ error: 'Chat tidak ditemukan' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify(chat), { headers: { 'Content-Type': 'application/json' } });
};

async function validateSession(env, token) {
  const data = await env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data);
}