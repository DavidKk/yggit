import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { escapeAppleScript, isCancelError, pickedPaths } from './shared'
import type { PickKind, PickPathCapability, PickPathOptions, PickResult } from './types'

const execFileAsync = promisify(execFile)

async function runOsascript(source: string): Promise<string> {
  const file = path.join(os.tmpdir(), `yggit-pick-${process.pid}-${Date.now()}.applescript`)
  fs.writeFileSync(file, `${source}\n`, 'utf8')
  try {
    const { stdout, stderr } = await execFileAsync('/usr/bin/osascript', [file], {
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    })
    const errText = String(stderr || '').trim()
    if (errText && !String(stdout || '').trim()) throw new Error(errText)
    return String(stdout || '').trim()
  } finally {
    try {
      fs.unlinkSync(file)
    } catch {
      /* ignore */
    }
  }
}

/** 对话框挂在 Finder 上才会到前台。取消（-128）原样抛出；其它失败退回 osascript 自己的窗口。 */
function frontScript(command: string, finish: string): string {
  return `
try
  tell application "Finder"
    activate
    set picked to (${command})
  end tell
on error errMsg number errNum
  if errNum is -128 then error errMsg number errNum
  set picked to (${command})
end try
${finish}
`.trim()
}

function scriptForApp(prompt: string): string {
  const p = escapeAppleScript(prompt)
  return frontScript(`choose file of type {"com.apple.application-bundle", "app"} with prompt "${p}"`, 'return POSIX path of picked')
}

function scriptForFolder(prompt: string, multiple: boolean): string {
  const p = escapeAppleScript(prompt)
  if (!multiple) return frontScript(`choose folder with prompt "${p}"`, 'return POSIX path of picked')
  return frontScript(
    `choose folder with prompt "${p}" with multiple selections allowed`,
    `set output to ""
if class of picked is list then
  repeat with folderRef in picked
    set output to output & POSIX path of (contents of folderRef) & linefeed
  end repeat
else
  set output to POSIX path of picked
end if
return output`
  )
}

export class OsxPickPath implements PickPathCapability {
  readonly id = 'pickPath' as const

  defaultPrompt(kind: PickKind): string {
    if (kind === 'app') return '选择干净的 NW.js（.app）作为壳源'
    if (kind === 'game') return '选择 RPG Maker 游戏目录，可一次多选（含 www、内容根，或已打包的 .app / 发布目录）'
    return '选择 RPG Maker 游戏目录（含 www、内容根，或已打包的 .app / 发布目录）'
  }

  async pick(kind: PickKind, prompt?: string, options?: PickPathOptions): Promise<PickResult> {
    const label = prompt || this.defaultPrompt(kind)
    const multiple = options?.multiple === true || kind === 'game'
    try {
      const stdout = kind === 'app' ? await runOsascript(scriptForApp(label)) : await runOsascript(scriptForFolder(label, multiple))
      const selected = pickedPaths(stdout)
      if (!selected) return { ok: false, cancelled: true }
      return { ok: true, ...selected }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isCancelError(msg)) return { ok: false, cancelled: true }
      return { ok: false, error: msg }
    }
  }
}
