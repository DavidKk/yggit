/**
 * Shared binary buffer heuristic matching Git's NUL-byte and control-character checks.
 */
export function looksBinaryBuffer(buf: Uint8Array): boolean {
  const limit = Math.min(buf.length, 8000)
  if (limit === 0) return false
  if (buf.subarray(0, limit).includes(0)) return true
  let weird = 0
  for (let i = 0; i < limit; i += 1) {
    const code = buf[i]
    if (code === 9 || code === 10 || code === 13) continue
    if (code < 32 || code === 127) weird += 1
  }
  return weird / limit > 0.12
}
