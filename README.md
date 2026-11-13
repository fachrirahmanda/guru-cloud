# Guru

Guru is a team chat app for asking questions to an AI model. Team members sign in with Google, chat with an AI model, keep their conversation history, group questions into projects, and an admin decides who is allowed in. The whole app runs on **Cloudflare Workers**.

The AI provider is designed to be swappable. The current code path is hard-wired to two providers, and making the provider configurable is planned work (see [Customizing the AI provider](#customizing-the-ai-provider)).

## Features

- **Google sign-in (OAuth).** Only emails listed in the `members` table can sign in.
- **Member management.** Admins can add and remove members.
- **AI chat.** Questions are answered by an AI model with conversation history. Users can attach images and text/PDF files.
- **Projects.** Questions can be grouped into projects, renamed, and deleted.
- **AI settings (admin only).** Provider, model, and API key can be set from the Settings page. API keys stored in the database are encrypted.
- **Profile.** Users can view and manage their own profile.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Cloudflare Worker with Hono; API routes under `/api/*` |
| Database | Cloudflare D1 (SQLite); migrations in `migrations/` |
| Sessions | Cloudflare KV (`SESSIONS` namespace) |
| AI | Pluggable provider (currently Google Gemini and NVIDIA) |

## Project structure

```
src/
  app/            Frontend: pages, components, API client
    pages/        Chat, ProjectView, Settings, Profile, Login
    components/   Shared UI components
  worker/
    index.ts      Worker entry point, all /api routes, and AI logic
    env.d.ts      Env binding types (regenerate with `npm run typegen`)
  shared/
    types.ts      Types shared by the frontend and the Worker
migrations/       Database schema changes, applied in order (0001, 0002, ...)
public/           Static assets: icons, manifest
wrangler.jsonc    Cloudflare Worker configuration
```

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .dev.vars.example .dev.vars
```

Required for sign-in (see `.dev.vars.example`):

| Name | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console (Credentials) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Must match a redirect URI registered in Google Console. For local dev: `http://localhost:5175/api/auth/callback` |
| `DEV_LOGIN` | Set to `true` only for local development. Enables a "Dev Login" button on localhost that skips Google sign-in. Never set this in production. |

AI provider variables are optional here, because the API key and model can also be set from the Settings page. See [Customizing the AI provider](#customizing-the-ai-provider).

> **Never commit `.dev.vars`.** It is listed in `.gitignore`. Do not put secret values in any tracked file.

### 3. Apply database migrations locally

```bash
npm run db:migrate:local
```

### 4. Start the dev server

```bash
npm run dev
```

Open `http://localhost:5175`. Add your email to the `members` table (from the admin UI, or directly in the local database) before signing in.

## Deploying to Cloudflare

1. Log in to Cloudflare: `npx wrangler login`
2. Create the D1 database and KV namespace if they don't exist yet, then update `database_id` and the KV `id` in `wrangler.jsonc`.
3. Apply migrations to the remote database:
   ```bash
   npm run db:migrate:remote
   ```
4. Set production secrets with Wrangler (not in files):
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
5. Deploy:
   ```bash
   npm run deploy
   ```

Set `GOOGLE_REDIRECT_URI` to your production URL (for example `https://<your-domain>/api/auth/callback`) and register the same URI in Google Console.

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server with the local Worker |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |
| `npm run db:migrate:remote` | Apply migrations to the production D1 database |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run typegen` | Regenerate the `Env` types in `src/worker/env.d.ts` |

## Customizing the AI provider

The goal is to let you plug in any AI provider (OpenAI-compatible APIs, Anthropic, a self-hosted model, and so on) without changing the chat UI. Today, the provider logic in `src/worker/index.ts` calls Google Gemini and NVIDIA directly, so adding a provider currently means adding a new function there and a branch in the provider selection.

## Notes

- `schema.sql` is an initial snapshot of the schema. Actual schema changes live in `migrations/`.
- The repo contains two Wrangler configuration files, `wrangler.jsonc` and `wrangler.toml`, with different contents (`main` points to `src/worker/index.ts` in one and `src/index.js` in the other). The `functions/` folder and `src/index.js` are remnants of an earlier setup. Keep one configuration before deploying.

## License

Not yet decided.
