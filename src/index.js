/* ========================================================
   Cloud Open Code — Cloudflare Worker entry point
   ======================================================== */

import { onRequestGet as authLogin } from '../functions/api/auth/login.js';
import { onRequestGet as authCallback } from '../functions/api/auth/callback.js';
import { onRequestPost as authLogout } from '../functions/api/auth/logout.js';
import { onRequestGet as authMe } from '../functions/api/auth/me.js';

import { onRequestGet as chatsList, onRequestPost as chatsCreate } from '../functions/api/chats.js';
import { onRequestGet as chatsGet } from '../functions/api/chats/[id].js';
import { onRequestGet as messagesList, onRequestPost as messagesCreate } from '../functions/api/chats/[chatId]/messages.js';

import { onRequestGet as membersList, onRequestPost as membersCreate } from '../functions/api/members.js';
import { onRequestDelete as membersDelete } from '../functions/api/members/[id].js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body = null, init = {}) {
  return new Response(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init.headers },
  });
}

function makeContext(request, env, params = {}) {
  return {
    request,
    env,
    params,
    waitUntil: () => {},
    passThroughOnException: () => {},
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse(null, { status: 204 });
    }

    // ========================================================
    // API ROUTES
    // ========================================================
    if (path.startsWith('/api/')) {
      try {
        // --- Auth ---
        if (path === '/api/auth/login' && method === 'GET') {
          return authLogin(makeContext(request, env));
        }
        if (path === '/api/auth/callback' && method === 'GET') {
          return authCallback(makeContext(request, env));
        }
        if (path === '/api/auth/logout' && method === 'POST') {
          return authLogout(makeContext(request, env));
        }
        if (path === '/api/auth/me' && method === 'GET') {
          return authMe(makeContext(request, env));
        }

        // --- Chats ---
        if (path === '/api/chats' && method === 'GET') {
          return chatsList(makeContext(request, env));
        }
        if (path === '/api/chats' && method === 'POST') {
          return chatsCreate(makeContext(request, env));
        }

        // --- Chat by ID ---
        const chatIdMatch = path.match(/^\/api\/chats\/([^\/]+)$/);
        if (chatIdMatch && method === 'GET') {
          return chatsGet(makeContext(request, env, { id: chatIdMatch[1] }));
        }

        // --- Messages ---
        const messagesMatch = path.match(/^\/api\/chats\/([^\/]+)\/messages$/);
        if (messagesMatch) {
          if (method === 'GET') {
            return messagesList(makeContext(request, env, { chatId: messagesMatch[1] }));
          }
          if (method === 'POST') {
            return messagesCreate(makeContext(request, env, { chatId: messagesMatch[1] }));
          }
        }

        // --- Members ---
        if (path === '/api/members' && method === 'GET') {
          return membersList(makeContext(request, env));
        }
        if (path === '/api/members' && method === 'POST') {
          return membersCreate(makeContext(request, env));
        }

        const memberIdMatch = path.match(/^\/api\/members\/([^\/]+)$/);
        if (memberIdMatch && method === 'DELETE') {
          return membersDelete(makeContext(request, env, { id: memberIdMatch[1] }));
        }

        return corsResponse(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return corsResponse(
          JSON.stringify({ error: 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========================================================
    // STATIC ASSETS (dari folder public/)
    // ========================================================
    let assetResponse = await env.ASSETS.fetch(request);

    // Jika file tidak ditemukan, coba tambahkan .html
    if (assetResponse.status === 404) {
      const htmlUrl = new URL(request.url);
      if (!htmlUrl.pathname.endsWith('.html') && !htmlUrl.pathname.includes('.')) {
        htmlUrl.pathname += '.html';
        assetResponse = await env.ASSETS.fetch(htmlUrl);
      }
    }

    // Fallback ke index.html untuk SPA-like routing (mis. /chat, /settings)
    if (assetResponse.status === 404) {
      if (path === '/settings') {
        assetResponse = await env.ASSETS.fetch(new URL('/settings.html', request.url));
      } else {
        assetResponse = await env.ASSETS.fetch(new URL('/index.html', request.url));
      }
    }

    return assetResponse;
  }
};
