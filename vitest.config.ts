import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/content/sync.test-helper.ts'],
    include: ['src/**/*.test.ts'],
  },
})
