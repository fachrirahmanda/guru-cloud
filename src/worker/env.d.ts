/* eslint-disable */
// Runtime binding types for the Cloudflare Worker.
interface __BaseEnv_Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI?: string;
  DEV_LOGIN?: string;
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_BASE_URL?: string;
  SETTINGS_KEY?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_MODEL?: string;
}
declare namespace Cloudflare {
  interface Env extends __BaseEnv_Env {}
}
interface Env extends __BaseEnv_Env {}
