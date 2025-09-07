import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vitest types are provided at runtime
import { configDefaults } from 'vitest/config'
import dotenv from 'dotenv'

// This is the new line that force-loads the .env.local file
dotenv.config({ path: './.env.local' });

// This section now reads from the newly loaded process.env
const {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY,
  VITE_TMDB_API_KEY
} = process.env;

export default defineConfig({
  // The define block remains, but it will now have variables to work with
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_TMDB_API_KEY': JSON.stringify(VITE_TMDB_API_KEY),
  },
  plugins: [
    react(),
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
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    exclude: [...configDefaults.exclude]
  }
} as any)