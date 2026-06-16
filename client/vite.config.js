import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BASE = env.VITE_BASE_PATH || '/galeria'

  return {
    plugins: [react()],
    base: BASE + '/',
    server: {
      port: 5177,
      proxy: {
        [`${BASE}/api`]:     { target: 'http://localhost:3002', rewrite: p => p.replace(BASE, '') },
        [`${BASE}/uploads`]: { target: 'http://localhost:3002', rewrite: p => p.replace(BASE, '') },
        [`${BASE}/thumbs`]:  { target: 'http://localhost:3002', rewrite: p => p.replace(BASE, '') },
      },
    },
  }
})
