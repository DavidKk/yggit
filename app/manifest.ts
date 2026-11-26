import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yggit — World Tree Git Workbench',
    short_name: 'Yggit',
    description: 'Organic World Tree Git DAG visualization, repository diagnostics, and local-first AI workbench.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1014',
    theme_color: '#10b981',
    icons: [
      {
        src: '/brand/yggdrasil-app-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/yggdrasil-app-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
