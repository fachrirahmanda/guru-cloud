export const onRequestDelete = async (context) => {
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

  const id = context.params.id;
  const { DB } = env;

  // Cek apakah member adalah admin terakhir
  const member = await DB.prepare('SELECT is_admin FROM members WHERE id = ?').bind(id).first();
  if (!member) {
    return new Response(JSON.stringify({ error: 'Member tidak ditemukan' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  if (member.is_admin === 1) {
    const adminCount = await DB.prepare('SELECT COUNT(*) as cnt FROM members WHERE is_admin = 1').first();
    if (adminCount.cnt <= 1) {
      return new Response(JSON.stringify({ error: 'Tidak dapat menghapus admin terakhir' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  await DB.prepare('DELETE FROM members WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

async function validateSession(env, token) {
  const data = await env.SESSIONS.get('session:' + token);
  if (!data) return null;
  return JSON.parse(data);
}