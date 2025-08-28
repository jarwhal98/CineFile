import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vitest types are provided at runtime
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    // Only enable PWA in production builds to avoid dev caching issues
    ...(process.env.NODE_ENV === 'production'
      ? [VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CineFile',
        short_name: 'CineFile',
        description: 'Local-first movie tracker',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('image.tmdb.org'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tmdb-posters',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })]
      : [])
  ],
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
