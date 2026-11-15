'use strict'

const { randomBytes } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

function accessDir() {
  const dataDir = process.env.YGGIT_DATA_DIR || process.env.CHAYA_DATA_DIR
  if (dataDir) return path.join(path.resolve(dataDir), 'access')
  if (process.platform === 'darwin' && process.env.HOME) {
    return path.join(process.env.HOME, 'Library', 'Application Support', 'Yggit', 'data', 'access')
  }
  return path.resolve(__dirname, '../../data/access')
}

function ensureAccessToken() {
  const envToken = process.env.YGGIT_AUTH_TOKEN || process.env.CHAYA_AUTH_TOKEN
  if (envToken) return envToken
  const dir = accessDir()
  const file = path.join(dir, 'token')
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  if (!fs.existsSync(file)) {
    // Electron and Next may start together: write temp then atomic publish to avoid an empty token.
    const pending = `${file}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
    try {
      fs.writeFileSync(pending, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 })
      try {
        fs.linkSync(pending, file)
      } catch (err) {
        if (err.code !== 'EEXIST') throw err
      }
    } finally {
      fs.rmSync(pending, { force: true })
    }
  }
  const token = fs.readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('invalid data/access/token; remove it and restart')
  return token
}

module.exports = { ensureAccessToken }
