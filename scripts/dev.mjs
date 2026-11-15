#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import concurrently from 'concurrently'

import ensureListenPortMod from './server/ensure-listen-port.cjs'

const { ensureListenPort } = ensureListenPortMod
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const isApp = args.includes('--app')
const isLoopback = args.includes('--loopback')
const service = isApp ? 'app' : 'local'
const apiLan = isLoopback ? '0' : '1'
const host = isLoopback ? '127.0.0.1' : '0.0.0.0'
const isSymlinkNodeModules = (() => {
  try {
    return fs.lstatSync(path.join(root, 'node_modules')).isSymbolicLink()
  } catch {
    return false
  }
})()
const webpackFlag = args.includes('--webpack') || isSymlinkNodeModules ? '--webpack ' : ''
const port = process.env.PORT || '3000'

// 1. Ensure target port is free
await ensureListenPort(port)

// 2. Run Next.js dev server
const commands = [
  {
    command: `node scripts/server/next-listen.mjs dev ${webpackFlag}-p ${port} -H ${host}`,
    name: 'next',
    prefixColor: 'blue',
    env: { YGGIT_SERVICE: service, YGGIT_API_LAN: apiLan, CHAYA_SERVICE: service, CHAYA_API_LAN: apiLan },
  },
]

const { result } = concurrently(commands, {
  cwd: root,
  killOthers: ['failure', 'success'],
})

result.catch((error) => {
  if (Array.isArray(error)) {
    const failed = error.find((e) => e.exitCode !== 0 && e.exitCode !== null)
    if (failed) process.exit(failed.exitCode ?? 1)
  }
  process.exit(0)
})
