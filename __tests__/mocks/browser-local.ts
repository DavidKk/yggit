export type BrowserLocalPhase = 'idle' | 'downloading' | 'preparing' | 'ready' | 'failed'

export async function ensureBrowserLocalModel() {
  return Promise.resolve()
}

export async function runBrowserLocalCompletion() {
  return Promise.resolve({ text: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
}

export async function unloadAndClearBrowserLocalModel() {
  return Promise.resolve(0)
}
