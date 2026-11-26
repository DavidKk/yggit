'use strict'

/**
 * Yggit Desktop App — Electron main process.
 * - Dev: assume Next is already up via `pnpm dev:app` when YGGIT_ELECTRON_EXTERNAL=1;
 *   otherwise spawn `next dev` with YGGIT_SERVICE=app.
 * - Packaged: when `app.isPackaged`, start Next standalone from Resources/app-root.
 */
const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const PORT = Number(process.env.PORT || process.env.YGGIT_PORT || process.env.CHAYA_PORT || 3927)
const HOST = process.env.YGGIT_HOST || process.env.CHAYA_HOST || '127.0.0.1'
const ROOT_URL = `http://${HOST}:${PORT}`
const REPO_ROOT = path.join(__dirname, '..')
const APP_ICON = path.join(__dirname, 'assets', 'icon.png')
const EXTERNAL = (process.env.YGGIT_ELECTRON_EXTERNAL || process.env.CHAYA_ELECTRON_EXTERNAL) === '1'
const PACKAGED = app.isPackaged

function applyPackagedEnv() {
  if (!PACKAGED) return
  const appRoot = path.join(process.resourcesPath, 'app-root')
  const dataDir = path.join(app.getPath('userData'), 'data')
  const logsDir = path.join(app.getPath('userData'), 'logs')
  process.env.YGGIT_ROOT = appRoot
  process.env.CHAYA_ROOT = appRoot
  process.env.YGGIT_DATA_DIR = dataDir
  process.env.CHAYA_DATA_DIR = dataDir
  process.env.YGGIT_LOGS_DIR = logsDir
  process.env.CHAYA_LOGS_DIR = logsDir
  process.env.YGGIT_SERVICE = process.env.YGGIT_SERVICE || 'app'
  process.env.CHAYA_SERVICE = process.env.CHAYA_SERVICE || 'app'
}

applyPackagedEnv()

const { ensureAccessToken } = require('../scripts/server/local-access.cjs')
const accessToken = ensureAccessToken()
process.env.YGGIT_AUTH_TOKEN = accessToken
process.env.CHAYA_AUTH_TOKEN = accessToken

/** @type {import('node:child_process').ChildProcess | null} */
let nextProc = null
/** @type {BrowserWindow | null} */
let mainWindow = null
let quitting = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now()
  let lastErr = ''
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status > 0) return
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
    await sleep(400)
  }
  throw new Error(`server not ready within ${timeoutMs}ms: ${url}${lastErr ? ` (${lastErr})` : ''}`)
}

function spawnNext(args, { cwd, env }) {
  nextProc = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  nextProc.on('exit', (code, signal) => {
    if (!quitting && code && code !== 0) {
      console.error(`[electron] next exited code=${code} signal=${signal}`)
    }
  })
}

function startStandalone(appRoot) {
  const serverJs = path.join(appRoot, 'server.js')
  if (!fs.existsSync(serverJs)) {
    throw new Error(`Next standalone not found: ${serverJs}`)
  }
  const apiLan = HOST === '127.0.0.1' ? '0' : process.env.YGGIT_API_LAN || process.env.CHAYA_API_LAN
  spawnNext([serverJs], {
    cwd: appRoot,
    env: {
      ...process.env,
      YGGIT_SERVICE: 'app',
      CHAYA_SERVICE: 'app',
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOSTNAME: HOST,
      YGGIT_API_LAN: apiLan,
      CHAYA_API_LAN: apiLan,
    },
  })
}

function startNextDev() {
  const apiLan = HOST === '127.0.0.1' ? '0' : process.env.YGGIT_API_LAN || process.env.CHAYA_API_LAN
  const env = {
    ...process.env,
    YGGIT_SERVICE: 'app',
    CHAYA_SERVICE: 'app',
    ELECTRON_RUN_AS_NODE: '1',
    YGGIT_API_LAN: apiLan,
    CHAYA_API_LAN: apiLan,
    FORCE_COLOR: process.env.FORCE_COLOR || '1',
  }
  const args = [path.join(REPO_ROOT, 'scripts/server/next-listen.mjs'), 'dev', '-p', String(PORT), '-H', HOST]
  spawnNext(args, { cwd: REPO_ROOT, env })
}

function startNext() {
  if (EXTERNAL) return
  if (PACKAGED) {
    startStandalone(path.join(process.resourcesPath, 'app-root'))
    return
  }
  startNextDev()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Yggit',
    icon: APP_ICON,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  void mainWindow.loadURL(ROOT_URL)
}

function stopNext() {
  if (!nextProc || nextProc.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(nextProc.pid), '/f', '/t'], { shell: true })
    } else {
      nextProc.kill('SIGTERM')
    }
  } catch {
    /* ignore */
  }
  nextProc = null
}

app.whenReady().then(async () => {
  process.env.YGGIT_SERVICE = process.env.YGGIT_SERVICE || 'app'
  process.env.CHAYA_SERVICE = process.env.CHAYA_SERVICE || 'app'
  app.dock?.setIcon(APP_ICON)
  try {
    startNext()
    await waitForServer(ROOT_URL)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    stopNext()
    app.quit()
    return
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
  stopNext()
})

app.on('window-all-closed', () => {
  stopNext()
  if (process.platform !== 'darwin') app.quit()
})
