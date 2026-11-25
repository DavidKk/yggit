import dns from 'node:dns/promises'
import net from 'node:net'

import { getServiceMode } from '@/lib/service-mode'

const CLOUD_METADATA_HOSTS = new Set(['169.254.169.254', '100.100.100.200', 'metadata.google.internal', 'metadata.goog', 'fd00:ec2::254'])

const BLOCKED_HOST_SUFFIXES = ['.internal', '.local', '.localhost']

function isIpv4PrivateOrReserved(ip: string, allowLan: boolean): boolean {
  const parts = ip.split('.').map((n) => Number.parseInt(n, 10))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true

  const [a, b] = parts

  // Always block link-local / cloud metadata (169.254.0.0/16) and unspecified (0.0.0.0/8)
  if (a === 169 && b === 254) return true
  if (a === 0) return true

  if (allowLan) return false

  // Loopback 127.0.0.0/8
  if (a === 127) return true
  // Private 10.0.0.0/8
  if (a === 10) return true
  // Private 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  // Private 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isIpv6PrivateOrReserved(ip: string, allowLan: boolean): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized.startsWith('::ffff:')) {
    return isIpv4PrivateOrReserved(normalized.slice(7), allowLan)
  }

  // Always block link-local (fe80::/10) and EC2 metadata
  if (normalized.startsWith('fe80:') || normalized === 'fd00:ec2::254') return true

  if (allowLan) return false

  if (normalized === '::1' || normalized === '::') return true
  // Unique Local Addresses fc00::/7
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  return false
}

function isDisallowedIp(ip: string, allowLan: boolean): boolean {
  const version = net.isIP(ip)
  if (version === 4) return isIpv4PrivateOrReserved(ip, allowLan)
  if (version === 6) return isIpv6PrivateOrReserved(ip, allowLan)
  return false
}

/**
 * Validate an outbound URL against SSRF risks.
 * Always blocks non-HTTP(S) schemes, embedded credentials, and cloud metadata endpoints.
 * In remote/cloud mode, also blocks loopback, private, and link-local IP ranges (including DNS resolution).
 */
export async function assertSafeOutboundUrl(rawUrl: string, options?: { allowLocalInDev?: boolean }): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid outbound URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Disallowed URL protocol: ${parsed.protocol}`)
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) {
    throw new Error('Missing URL hostname')
  }

  if (CLOUD_METADATA_HOSTS.has(host)) {
    throw new Error('Access to cloud metadata endpoints is blocked')
  }

  const isRemote = getServiceMode() === 'remote'
  const allowLan = !isRemote && (options?.allowLocalInDev ?? true)

  if (!allowLan) {
    if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      throw new Error('Access to internal or local hostnames is not allowed in remote mode')
    }
  }

  if (net.isIP(host) !== 0) {
    if (isDisallowedIp(host, allowLan)) {
      throw new Error('Access to private or reserved IP address is blocked')
    }
    return parsed
  }

  // Perform DNS lookup in production/non-test runtimes to mitigate DNS-rebinding SSRF
  if (process.env.NODE_ENV !== 'test' && !allowLan) {
    try {
      const records = await dns.lookup(host, { all: true })
      for (const record of records) {
        if (isDisallowedIp(record.address, false)) {
          throw new Error('Resolved IP address is in a private or reserved range')
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('private or reserved')) {
        throw err
      }
      // If DNS lookup fails transiently, let fetch handle connection error safely
    }
  }

  return parsed
}
