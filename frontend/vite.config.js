import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy : les requêtes vers /api sont redirigées vers le backend (évite CORS en dev)
  server: {
    host: true, // écoute sur 0.0.0.0 pour accès depuis le téléphone (http://IP_PC:5173)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
