import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/chat': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/extract-keypoints': 'http://localhost:8000',
      '/tools': 'http://localhost:8000',
      '/structured-interview': 'http://localhost:8000',
      '/design-interview': 'http://localhost:8000',
      '/tts': 'http://localhost:8000',
      '/workflow': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
