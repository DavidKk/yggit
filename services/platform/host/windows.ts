import path from 'node:path'

import { assertPathExists, spawnDetached } from './shared'
import type { HostShellCapability, LaunchShellOptions } from './types'

export class WindowsHostShell implements HostShellCapability {
  readonly id = 'hostShell' as const

  reveal(targetPath: string): Promise<void> {
    assertPathExists(targetPath)
    return spawnDetached('explorer.exe', [`/select,${path.resolve(targetPath)}`])
  }

  open(targetPath: string): Promise<void> {
    assertPathExists(targetPath)
    const p = path.resolve(targetPath)
    if (p.toLowerCase().endsWith('.exe')) {
      return spawnDetached(p, [], { cwd: path.dirname(p) })
    }
    return spawnDetached('explorer.exe', [p])
  }

  launchShell(shellApp: string, contentRoot: string, _options?: LaunchShellOptions): Promise<void> {
    assertPathExists(shellApp)
    assertPathExists(contentRoot)
    return spawnDetached(shellApp, [path.resolve(contentRoot)], { cwd: path.dirname(shellApp) })
  }
}

