export { canUseDisk, diskUnavailable, requireDisk } from '@/lib/service-mode'
import { resolveHostShell, resolvePickPath } from '@/services/platform'
import type { PickKind, PickPathOptions, PickResult } from '@/services/platform/pick/types'

export type { PickKind, PickResult }

export function revealInFinder(targetPath: string): Promise<void> {
  return resolveHostShell().reveal(targetPath)
}

export function openInFinder(targetPath: string): Promise<void> {
  return resolveHostShell().open(targetPath)
}

export async function pickPath(kind: PickKind, prompt?: string, options?: PickPathOptions): Promise<PickResult> {
  return resolvePickPath().pick(kind, prompt, options)
}
