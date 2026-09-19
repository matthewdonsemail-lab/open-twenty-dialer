import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plain Vite for the frontend ONLY. The Hono worker is built by the Railcode
// CLI (esbuild) for both `railcode dev` and `railcode deploy` — so there is no
// worker build here, no Cloudflare plugin, and no wrangler.
export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
})
