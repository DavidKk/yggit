import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Returns the URL configured for a specific git remote.
 */
export async function gitGetRemoteUrl(repo: string, remote: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repo, 'remote', 'get-url', remote], { timeout: 8000, encoding: 'utf8' })
    return stdout.trim()
  } catch {
    return ''
  }
}

/**
 * Updates the URL for a remote: git remote set-url <remote> <newUrl>
 */
export async function gitSetRemoteUrl(repo: string, remote: string, newUrl: string): Promise<{ ok: boolean; message: string }> {
  try {
    await execFileAsync('git', ['-C', repo, 'remote', 'set-url', remote, newUrl.trim()], { timeout: 8000, encoding: 'utf8' })
    return { ok: true, message: `已成功更新远程源 ${remote} 的地址` }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `更新远程源 ${remote} 失败`)
  }
}

/**
 * Renames a remote: git remote rename <oldName> <newName>
 */
export async function gitRenameRemote(repo: string, oldName: string, newName: string): Promise<{ ok: boolean; message: string }> {
  try {
    await execFileAsync('git', ['-C', repo, 'remote', 'rename', oldName.trim(), newName.trim()], { timeout: 8000, encoding: 'utf8' })
    return { ok: true, message: `已成功将远程源重命名为 ${newName}` }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `重命名远程源 ${oldName} 失败`)
  }
}

/**
 * Removes a remote: git remote remove <remote>
 */
export async function gitRemoveRemote(repo: string, remote: string): Promise<{ ok: boolean; message: string }> {
  try {
    await execFileAsync('git', ['-C', repo, 'remote', 'remove', remote.trim()], { timeout: 8000, encoding: 'utf8' })
    return { ok: true, message: `已成功删除远程源 ${remote}` }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `删除远程源 ${remote} 失败`)
  }
}

/**
 * Adds a new remote: git remote add <name> <url>
 * If pushUrl is provided and distinct, configures push URL: git remote set-url --push <name> <pushUrl>
 */
export async function gitAddRemote(repo: string, name: string, pullUrl: string, pushUrl?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const trimmedName = name.trim()
    const trimmedPull = pullUrl.trim()
    await execFileAsync('git', ['-C', repo, 'remote', 'add', trimmedName, trimmedPull], { timeout: 8000, encoding: 'utf8' })
    if (pushUrl && pushUrl.trim() && pushUrl.trim() !== trimmedPull) {
      await execFileAsync('git', ['-C', repo, 'remote', 'set-url', '--push', trimmedName, pushUrl.trim()], { timeout: 8000, encoding: 'utf8' })
    }
    return { ok: true, message: `已成功添加远程源 ${trimmedName}` }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `添加远程源 ${name} 失败`)
  }
}

/**
 * Sets the upstream tracking branch for a local branch:
 * git branch --set-upstream-to=<upstream> <branch>
 */
export async function gitSetUpstream(repo: string, branch: string, upstream: string): Promise<{ ok: boolean; message: string }> {
  try {
    const trimmedBranch = branch.trim()
    const trimmedUpstream = upstream.trim()
    await execFileAsync('git', ['-C', repo, 'branch', `--set-upstream-to=${trimmedUpstream}`, trimmedBranch], { timeout: 8000, encoding: 'utf8' })
    return { ok: true, message: `已成功将 ${trimmedBranch} 的上游设置为 ${trimmedUpstream}` }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `设置上游分支失败`)
  }
}
