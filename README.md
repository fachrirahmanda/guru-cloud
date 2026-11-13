# Guru

Guru adalah aplikasi chat AI untuk tim kecil. Tim bisa mengobrol dengan model AI (Google Gemini atau NVIDIA), menyimpan riwayat tanya-jawab, mengelompokkan pertanyaan ke dalam project, dan mengelola anggota yang boleh masuk. Aplikasi ini berjalan sepenuhnya di **Cloudflare Workers**.

## Fitur

- **Login dengan Google OAuth.** Hanya email yang terdaftar di tabel `members` yang bisa masuk.
- **Manajemen anggota.** Admin bisa menambah dan menghapus anggota.
- **Chat AI.** Pertanyaan dijawab oleh model AI dengan riwayat percakapan. Pengguna bisa melampirkan gambar dan file (teks/PDF).
- **Project.** Riwayat pertanyaan bisa dikelompokkan ke dalam project, lalu diubah nama atau dihapus.
- **Pengaturan AI (khusus admin).** Provider (Gemini atau NVIDIA), model, dan API key bisa diatur dari halaman Settings. API key yang disimpan di database dienkripsi.
- **Profil.** Pengguna bisa melihat dan mengatur profilnya.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Cloudflare Worker dengan Hono, route di bawah `/api/*` |
| Database | Cloudflare D1 (SQLite), migrasi di `migrations/` |
| Session | Cloudflare KV (namespace `SESSIONS`) |
| AI | Google Gemini API dan NVIDIA API (OpenAI-compatible) |

## Struktur folder

```
src/
  app/            Frontend: halaman, komponen, dan API client
    pages/        Chat, ProjectView, Settings, Profile, Login
    components/   Komponen UI bersama
  worker/
    index.ts      Entry point Worker, semua route /api, dan logika AI
    env.d.ts      Tipe binding Env (hasil `npm run typegen`)
  shared/
    types.ts      Tipe yang dipakai frontend dan Worker
migrations/       Perubahan skema database (urut: 0001, 0002, ...)
public/           Aset statis: ikon, manifest
wrangler.jsonc    Konfigurasi Cloudflare Worker (dipakai saat deploy)
```

## Menjalankan secara lokal

### 1. Install dependency

```bash
npm install
```

### 2. Siapkan variabel lingkungan

Salin file contoh lalu isi nilainya:

```bash
cp .dev.vars.example .dev.vars
```

Variabel yang tersedia (lihat `.dev.vars.example`):

| Nama | Keterangan |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID dari Google Cloud Console (Credentials) |
| `GOOGLE_CLIENT_SECRET` | Client secret dari Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Harus sama dengan redirect URI yang terdaftar di Google Console. Untuk lokal: `http://localhost:5175/api/auth/callback` |
| `DEV_LOGIN` | Isi `true` hanya untuk development lokal. Mengaktifkan tombol "Dev Login" tanpa Google di localhost. Jangan diisi di produksi. |

Opsional, untuk AI (bisa juga diisi lewat halaman Settings):

| Nama | Keterangan |
|---|---|
| `GEMINI_API_KEY` | API key Google AI Studio |
| `GEMINI_MODEL` | Model Gemini (default: `gemini-flash-latest`) |
| `NVIDIA_API_KEY` | API key NVIDIA (diawali `nvapi-`) |
| `NVIDIA_MODEL` | Model NVIDIA |

> **Jangan commit `.dev.vars`.** File ini sudah di-ignore oleh `.gitignore`. Jangan memasukkan nilai secret ke file lain yang ter-track git.

### 3. Migrasi database lokal

```bash
npm run db:migrate:local
```

### 4. Jalankan aplikasi

```bash
npm run dev
```

Buka `http://localhost:5175` di browser. Tambahkan email Anda ke tabel `members` (lewat halaman admin, atau langsung di database lokal) sebelum login.

## Deploy ke Cloudflare

1. Login ke Cloudflare: `npx wrangler login`
2. Buat database D1 dan KV namespace jika belum ada, lalu sesuaikan `database_id` dan `id` di `wrangler.jsonc`.
3. Jalankan migrasi ke remote:
   ```bash
   npm run db:migrate:remote
   ```
4. Set secret produksi (jangan lewat file):
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put GEMINI_API_KEY   # atau NVIDIA_API_KEY
   ```
5. Deploy:
   ```bash
   npm run deploy
   ```

Set `GOOGLE_REDIRECT_URI` ke URL produksi (misalnya `https://<domain>/api/auth/callback`) dan daftarkan URL yang sama di Google Console.

## Script npm

| Script | Fungsi |
|---|---|
| `npm run dev` | Jalankan Vite dev server dengan Worker lokal |
| `npm run build` | Cek tipe TypeScript dan build produksi |
| `npm run preview` | Preview hasil build |
| `npm run db:migrate:local` | Terapkan migrasi ke D1 lokal |
| `npm run db:migrate:remote` | Terapkan migrasi ke D1 produksi |
| `npm run deploy` | Build lalu deploy ke Cloudflare |
| `npm run typegen` | Generate ulang tipe `Env` di `src/worker/env.d.ts` |

## Catatan

- `schema.sql` adalah gambaran skema awal. Perubahan skema yang berlaku dilakukan lewat file di `migrations/`.
- Di folder root ada dua file konfigurasi Wrangler, `wrangler.jsonc` dan `wrangler.toml`, dengan isi yang berbeda (entry point `src/worker/index.ts` di `.jsonc`, `src/index.js` di `.toml`). Folder `functions/` dan `src/index.js` adalah sisa dari versi sebelumnya. Sebaiknya hanya satu konfigurasi yang dipertahankan sebelum deploy.

## Lisensi

Belum ditentukan.
