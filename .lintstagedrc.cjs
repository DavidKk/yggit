const RUNTIME_PATH_RE =
  /(^|\/)(data|logs|coverage|out|build|dist|tmp|\.next|\.jest-yggit-root|\.cursor|\.husky)(\/|$)/
const GENERATED_FILE_RE = /(^|\/)next-env\.d\.ts$/

function isSourcePath(file) {
  const normalized = file.replace(/\\/g, '/')
  if (GENERATED_FILE_RE.test(normalized)) return false
  return !RUNTIME_PATH_RE.test(normalized)
}

function isEslintPath(file) {
  const normalized = file.replace(/\\/g, '/')
  return isSourcePath(normalized)
}

module.exports = {
  '**/*.{js,jsx,cjs,ts,tsx,md,yml,yaml,json,css,mjs}': (files) => {
    const filtered = files.filter(isSourcePath)
    if (filtered.length === 0) return []
    return `prettier --config .prettierrc.cjs --write ${filtered.map((file) => JSON.stringify(file)).join(' ')}`
  },
  '**/*.{ts,tsx,mjs}': (files) => {
    const filtered = files.filter(isEslintPath)
    if (filtered.length === 0) return []
    return `eslint --config eslint.config.mjs --max-warnings 0 --no-warn-ignored ${filtered.map((file) => JSON.stringify(file)).join(' ')}`
  },
}
