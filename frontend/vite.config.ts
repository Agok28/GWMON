import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:8000',
      '/traffic': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/firewall': 'http://localhost:8000',
      '/alerts': {
        target: 'http://localhost:8000',
        bypass: (req) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
    },
  },
})
