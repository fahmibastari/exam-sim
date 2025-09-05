// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EXAMLENT',
    short_name: 'ExLnt',
    start_url: '/?icon=v2',         // bust cache ikon
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      { src: '/icons/icon-192x192.v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512x512.v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/monochrome-512x512.v2.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' }
    ]
  }
}
