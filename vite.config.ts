import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

const shared = globalThis as { cloudOpenCodeBuildId?: string };
shared.cloudOpenCodeBuildId ??= Date.now().toString(36);

export default defineConfig({
  plugins: [react(), cloudflare()],
  define: { __BUILD_ID__: JSON.stringify(shared.cloudOpenCodeBuildId) },
  server: { port: 5175, strictPort: true },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [{ name: 'vendor', test: /node_modules[\/](react|react-dom|react-router|scheduler)[\/]/ }],
            },
          },
        },
      },
    },
  },
});
