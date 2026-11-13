export const onRequestGet = async (context) => {
  const { env } = context;
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);
  const sessionData = await env.SESSIONS.get('session:' + token);
  if (!sessionData) {
    return new Response(JSON.stringify({ error: 'Session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = JSON.parse(sessionData);
  return new Response(JSON.stringify({
    email: session.email,
    is_admin: session.is_admin === true || session.is_admin === 1,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};