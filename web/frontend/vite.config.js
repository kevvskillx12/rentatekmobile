import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    // Redirige las llamadas /api al backend local (backend/server.js)
    proxy: { '/api': 'http://localhost:3001' }
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'img/*.jpg', 'img/*.jpeg'],
      workbox: { navigateFallbackDenylist: [/^\/api/] },
      manifest: {
        name: 'Rentatek - Maquinaria en renta',
        short_name: 'Rentatek',
        description: 'Encuentra, compara y contacta proveedores de maquinaria.',
        lang: 'es',
        theme_color: '#172033',
        background_color: '#f7f8fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      devOptions: { enabled: true }
    })
  ]
});
