import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// Builds the API server into one self-contained ESM file: server-dist/server.mjs.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'server/main.ts',
    outDir: 'server-dist',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    copyPublicDir: false,
    rollupOptions: {
      output: { entryFileNames: 'server.mjs', codeSplitting: false },
    },
  },
})
