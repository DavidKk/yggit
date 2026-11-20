/**
 * Strip ANSI escape codes and terminal color sequences from a string.
 */
export function stripAnsi(str?: string | null): string {
  if (!str) return ''
  return (
    str
      // Standard ANSI escape sequences (e.g. \x1b[0;36m, \x1b[0m, etc.)
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
      // Fallback for raw text like "[0;36m" or "[0m" if escape char was already stripped or missing
      .replace(/\[0;[0-9]+m/g, '')
      .replace(/\[[0-9]+m/g, '')
      .replace(/\[0m/g, '')
  )
}
