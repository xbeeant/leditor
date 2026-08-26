import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@leditor/lexical-editor': fileURLToPath(
        new URL('../lexical-editor/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
});
