import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/linear_algebra/' : '/'

  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://localhost:4174',
      },
    },
  }
})

