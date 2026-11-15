import type { GitProjectHost } from '@/lib/git/types'

export const GIT_LOG_PAGE_SIZE = 40

export type RemoteIdentity = {
  key: string
  host: string
  kind: Exclude<GitProjectHost, 'local'>
  name: string
  httpsUrl: string
}

function sha1(message: string): string {
  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(message) : Buffer.from(message, 'utf8')
  const m: number[] = []
  for (let i = 0; i < enc.length; i++) m[i >> 2] |= (enc[i] & 0xff) << (24 - (i % 4) * 8)
  m[enc.length >> 2] |= 0x80 << (24 - (enc.length % 4) * 8)
  m[(((enc.length + 8) >> 6) << 4) + 15] = enc.length * 8

  const w = new Array<number>(80)
  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878
  let e = -1009589776

  for (let i = 0; i < m.length; i += 16) {
    const olda = a
    const oldb = b
    const oldc = c
    const oldd = d
    const olde = e

    for (let j = 0; j < 80; j++) {
      if (j < 16) w[j] = m[i + j] || 0
      else {
        const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]
        w[j] = (t << 1) | (t >>> 31)
      }
      const t =
        (((a << 5) | (a >>> 27)) +
          e +
          w[j] +
          (j < 20 ? ((b & c) | (~b & d)) + 1518500249 : j < 40 ? (b ^ c ^ d) + 1859775393 : j < 60 ? ((b & c) | (b & d) | (c & d)) - 1894007588 : (b ^ c ^ d) - 899497514)) |
        0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = t
    }
    a = (a + olda) | 0
    b = (b + oldb) | 0
    c = (c + oldc) | 0
    d = (d + oldd) | 0
    e = (e + olde) | 0
  }

  return [a, b, c, d, e].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

export function projectId(key: string): string {
  return sha1(key).slice(0, 16)
}

export function hostKind(host: string): Exclude<GitProjectHost, 'local'> {
  const name = host.toLowerCase()
  if (name === 'github.com' || name.endsWith('.github.com')) return 'github'
  return 'gitlab'
}

/** One canonical key for ssh, https, and credentialed URLs of the same repo. */
export function normalizeRemote(raw: string): RemoteIdentity | null {
  const input = raw.trim()
  if (!input) return null
  let host = ''
  let pathName = ''
  if (input.startsWith('git@') && input.includes(':')) {
    const rest = input.slice('git@'.length)
    const colon = rest.indexOf(':')
    host = rest.slice(0, colon)
    pathName = rest.slice(colon + 1)
  } else if (input.includes('://')) {
    try {
      const url = new URL(input)
      host = url.hostname
      pathName = url.pathname.replace(/^\//, '')
    } catch {
      return null
    }
  } else return null
  host = host.toLowerCase()
  pathName = pathName.replace(/\.git$/i, '').replace(/\/+$/, '')
  if (!host || !pathName || pathName.includes('..')) return null
  const name = pathName.split('/').filter(Boolean).pop() || pathName
  const kind = hostKind(host)
  return { key: `${host}/${pathName}`, host, kind, name, httpsUrl: `https://${host}/${pathName}.git` }
}
