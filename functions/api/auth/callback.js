export const onRequestGet = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response('OAuth error: ' + error, { status: 400 });
  }
  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI || new URL('/api/auth/callback', request.url).toString();

  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Exchange code untuk token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error('Token exchange error:', errorBody);
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: errorBody }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tokens = await tokenRes.json();

    // 2. Ambil info user dari Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get user info' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const googleUser = await userRes.json();
    const email = googleUser.email;

    // Validasi: harus Gmail
    if (!email || !email.endsWith('@gmail.com')) {
      return new Response(
        '<html><body><script>alert("Hanya akun Gmail yang diizinkan."); window.location.href="/";</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // 3. Cek apakah email terdaftar di tabel members
    const { DB } = env;
    const member = await DB.prepare(
      'SELECT id, email, is_admin FROM members WHERE email = ?'
    ).bind(email).first();

    if (!member) {
      return new Response(
        '<html><body><script>alert("Email Anda belum terdaftar. Hubungi admin untuk ditambahkan."); window.location.href="/";</script></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // 4. Buat session token dan simpan di KV
    const sessionToken = crypto.randomUUID();
    const sessionData = JSON.stringify({
      email: member.email,
      is_admin: member.is_admin === 1,
      createdAt: new Date().toISOString(),
    });
    await env.SESSIONS.put('session:' + sessionToken, sessionData, {
      expirationTtl: 7 * 24 * 60 * 60, // 7 hari
    });

    // 5. Set cookie session dan redirect ke chat
    const chatUrl = new URL('/chat', request.url).toString();
    const response = Response.redirect(chatUrl, 302, {
      headers: {
        'Set-Cookie':
          'session_token=' +
          sessionToken +
          '; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800;',
      },
    });
    return response;
  } catch (e) {
    console.error('Auth error:', e);
    return new Response(JSON.stringify({ error: 'Authentication failed', detail: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};