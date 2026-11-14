import path from 'node:path'

import { assertPathExists, spawnDetached } from './shared'
import type { HostShellCapability, LaunchShellOptions } from './types'

export class LinuxHostShell implements HostShellCapability {
  readonly id = 'hostShell' as const

  reveal(targetPath: string): Promise<void> {
    assertPathExists(targetPath)
    const abs = path.resolve(targetPath)
    const dir = path.dirname(abs)
    return spawnDetached('xdg-open', [dir])
  }

  open(targetPath: string): Promise<void> {
    assertPathExists(targetPath)
    return spawnDetached('xdg-open', [path.resolve(targetPath)])
  }

  launchShell(shellApp: string, contentRoot: string, _options?: LaunchShellOptions): Promise<void> {
    assertPathExists(shellApp)
    assertPathExists(contentRoot)
    return spawnDetached(shellApp, [path.resolve(contentRoot)], { cwd: path.dirname(shellApp) })
  }
}

