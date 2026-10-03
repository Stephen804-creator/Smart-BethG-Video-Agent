import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: path.resolve(root, 'client/dist'),
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
