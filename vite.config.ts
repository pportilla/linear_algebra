import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function normalizeBasePath(value?: string) {
  if (!value || value.trim().length === 0) {
    return '/'
  }

  const trimmed = value.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const base =
    command === 'build'
      ? normalizeBasePath(process.env.VITE_BASE_PATH ?? (repositoryName ? `/${repositoryName}/` : '/'))
      : '/'

  return {
    base,
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          report: path.resolve(__dirname, 'report.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:4174',
      },
    },
  }
})

