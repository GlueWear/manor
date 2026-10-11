import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Dev and tests: the host (or the mock host) answers /~/ and the icon.
const target = process.env.MANOR_HOST || 'http://127.0.0.1:8083';
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {strictPort: true, proxy: Object.fromEntries(['/~/', '/apps/manor/icon.png', '/apps/noltbook/'].map(p => [p, {target, changeOrigin: true}]))},
  build: {target: 'es2022', sourcemap: false},
});
