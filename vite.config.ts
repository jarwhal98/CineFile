import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vitest types are provided at runtime
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true
  },
  // Vitest config (ignored by Vite types but picked up by Vitest)
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    exclude: [...configDefaults.exclude]
  }
} as any)
