import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yggit Remote Play',
    short_name: 'Yggit串流',
    description: 'RPG Maker WebRTC 局域网超低延迟串流游玩与触屏虚拟手柄控制台',
    start_url: '/play',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'landscape',
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
