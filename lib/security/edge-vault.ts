'use client'

const DB_NAME = 'yggit.edge-vault.v1'
const DB_VERSION = 1
const KEYS_STORE = 'keys'
const SECRETS_STORE = 'secrets'
const MASTER_KEY_ID = 'master-aes-gcm'

interface EdgeSealedPayload {
  v: 1
  iv: string
  ciphertext: string
}

export function isWebCryptoVaultSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && typeof window.crypto?.subtle !== 'undefined'
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE)
      }
      if (!db.objectStoreNames.contains(SECRETS_STORE)) {
        db.createObjectStore(SECRETS_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, storeName: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Retrieves or generates a non-extractable AES-GCM 256-bit CryptoKey stored in IndexedDB.
 * JS code cannot export raw key material (`extractable: false`).
 */
async function getOrCreateMasterCryptoKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, KEYS_STORE, MASTER_KEY_ID)
  if (existing) return existing

  const generated = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await idbPut(db, KEYS_STORE, MASTER_KEY_ID, generated)
  return generated
}

function buildAadBytes(profileId: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(`yggit:agent-profile:${profileId}`)
  const copy = new Uint8Array(encoded.byteLength)
  copy.set(encoded)
  return copy
}

export async function sealEdgeSecret(profileId: string, plaintext: string): Promise<void> {
  if (!isWebCryptoVaultSupported() || !profileId || !plaintext.trim()) return
  try {
    const db = await openVaultDb()
    const key = await getOrCreateMasterCryptoKey(db)
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: buildAadBytes(profileId),
      },
      key,
      encoded
    )
    const payload: EdgeSealedPayload = {
      v: 1,
      iv: toBase64Url(iv),
      ciphertext: toBase64Url(new Uint8Array(encrypted)),
    }
    await idbPut(db, SECRETS_STORE, profileId, payload)
    db.close()
  } catch {
    // Graceful no-op when browser IndexedDB or Web Crypto is restricted
  }
}

export async function openEdgeSecret(profileId: string): Promise<string | undefined> {
  if (!isWebCryptoVaultSupported() || !profileId) return undefined
  try {
    const db = await openVaultDb()
    const key = await idbGet<CryptoKey>(db, KEYS_STORE, MASTER_KEY_ID)
    const payload = await idbGet<EdgeSealedPayload>(db, SECRETS_STORE, profileId)
    db.close()
    if (!key || !payload || payload.v !== 1) return undefined

    const ivBytes = fromBase64Url(payload.iv)
    const iv = new Uint8Array(ivBytes.byteLength)
    iv.set(ivBytes)
    const ctBytes = fromBase64Url(payload.ciphertext)
    const ciphertext = new Uint8Array(ctBytes.byteLength)
    ciphertext.set(ctBytes)

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: buildAadBytes(profileId),
      },
      key,
      ciphertext
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return undefined
  }
}

export async function deleteEdgeSecret(profileId: string): Promise<void> {
  if (!isWebCryptoVaultSupported() || !profileId) return
  try {
    const db = await openVaultDb()
    await idbDelete(db, SECRETS_STORE, profileId)
    db.close()
  } catch {
    // Ignore errors when storage is unavailable
  }
}

/** Lists profile IDs that have an encrypted secret in IndexedDB without decrypting them. */
export async function listEdgeSecretIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!isWebCryptoVaultSupported()) return ids
  try {
    const db = await openVaultDb()
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(SECRETS_STORE, 'readonly')
      const store = tx.objectStore(SECRETS_STORE)
      const req = store.getAllKeys()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    for (const k of keys) {
      if (typeof k === 'string') ids.add(k)
    }
  } catch {
    // Ignore errors when storage is unavailable
  }
  return ids
}
