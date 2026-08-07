import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    // Rolldown's identifier minification renames function declarations in a way
    // that creates temporal dead zone crashes in production (can't access
    // lexical declaration before initialization). Disabling minification
    // prevents the renaming; Rolldown still strips dead code via "dce-only".
    minify: false,
  }
})
