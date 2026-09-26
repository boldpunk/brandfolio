import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // BASE_PATH=/brandfolio/ for GitHub Pages; the root by default.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  // `npm run dev` talks to the API server (server/) on its dev port; without it the cloud UI stays hidden.
  server: { proxy: { '/api': 'http://127.0.0.1:3517' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    // Tests assert Russian messages; Node reports en-US as the browser language.
    setupFiles: ['src/tests/setup.ts'],
  },
})
