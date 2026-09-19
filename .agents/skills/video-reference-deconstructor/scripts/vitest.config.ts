import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.resolve(scriptsDirectory, '..'),
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
    clearMocks: true,
  },
})
