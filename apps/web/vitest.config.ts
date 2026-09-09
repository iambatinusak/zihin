import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@zihin/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@zihin/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@zihin/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['{app,components,lib}/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
})
