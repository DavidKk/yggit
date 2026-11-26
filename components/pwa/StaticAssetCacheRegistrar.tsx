'use client'

import { useEffect } from 'react'

/** Register the static-asset Service Worker in production browser contexts. */
export function StaticAssetCacheRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return
    }
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Ignore registration failures in restricted environments
    })
  }, [])

  return null
}
