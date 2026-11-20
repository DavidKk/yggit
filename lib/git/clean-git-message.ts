import { stripAnsi } from '@/lib/utils/strip-ansi'

/**
 * Filter out noisy git hook execution banners, internal harness logs,
 * and decorative divider lines from git command output, returning only
 * meaningful human-readable feedback.
 */
export function cleanGitMessage(raw?: string | null, fallback = ''): string {
  if (!raw) return fallback
  const cleaned = stripAnsi(raw)
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((line) => {
      if (!line) return false
      // Decorative border lines: ----------------, ━━━━━━━━, ========
      if (/^[-=─━~_*#]{3,}$/.test(line)) return false
      // Hook runner banners and noise
      if (/^(Git Hook:|\.githooks\/|\[commit-msg\]|\[pre-push\]|\[pre-commit\]|\[post-commit\])/i.test(line)) return false
      if (/未找到项目本地 hook/i.test(line)) return false
      if (/正在执行/i.test(line) && /Hook/i.test(line)) return false
      return true
    })

  const result = lines.join('\n').trim()
  return result || fallback
}
