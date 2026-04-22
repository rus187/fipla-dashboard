import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api/stripe": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/taxware": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/runtime-debug": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/advisor": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
