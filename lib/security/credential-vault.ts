import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { AgentModelProfile } from '@/lib/agent/model-profiles'
import { AGENT_PRESETS, type EphemeralAgentConfig } from '@/lib/agent/types'

const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

export interface SealedCredential {
  v: 1
  keyVersion: number
  iv: string
  ciphertext: string
  tag: string
}

interface StoredProfileRecord {
  id: string
  name: string
  config: Omit<EphemeralAgentConfig, 'apiKey' | 'hasApiKey'>
  filter?: AgentModelProfile['filter']
  sealedApiKey?: SealedCredential
}

interface StoredVaultFile {
  v: 1
  activeId: string
  profiles: StoredProfileRecord[]
}

function resolveVaultDir(): string {
  const custom = process.env.YGGIT_VAULT_DIR?.trim()
  if (custom) return custom
  return path.join(os.homedir(), '.yggit')
}

function ensureVaultDir(): string {
  const dir = resolveVaultDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
  return dir
}

function buildAad(profileId: string): Buffer {
  return Buffer.from(`yggit:agent-profile:${profileId}`, 'utf8')
}

/**
 * Loads the 256-bit AES-GCM master key from YGGIT_CREDENTIAL_ENCRYPTION_KEY or ~/.yggit/credential.key (0600).
 */
function loadOrCreateMasterKey(): Buffer {
  const envKey = process.env.YGGIT_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (envKey) {
    const decoded = Buffer.from(envKey, 'base64url')
    if (decoded.length !== KEY_BYTES) {
      throw new Error(`YGGIT_CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes`)
    }
    return decoded
  }

  const dir = ensureVaultDir()
  const keyFile = path.join(dir, 'credential.key')
  if (fs.existsSync(keyFile)) {
    const raw = fs.readFileSync(keyFile, 'utf8').trim()
    const decoded = Buffer.from(raw, 'base64url')
    if (decoded.length === KEY_BYTES) {
      return decoded
    }
  }

  const generated = randomBytes(KEY_BYTES)
  const tmpFile = `${keyFile}.${process.pid}.tmp`
  fs.writeFileSync(tmpFile, generated.toString('base64url'), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmpFile, keyFile)
  try {
    fs.chmodSync(keyFile, 0o600)
  } catch {
    // Ignore chmod failures on filesystems without POSIX permissions
  }
  return generated
}

export function sealCredential(plaintext: string, profileId: string): SealedCredential {
  if (!profileId) throw new Error('Profile ID is required for credential sealing')
  const key = loadOrCreateMasterKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(buildAad(profileId))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    v: 1,
    keyVersion: 1,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  }
}

export function openCredential(sealed: SealedCredential, profileId: string): string {
  if (!profileId) throw new Error('Profile ID is required for credential opening')
  if (!sealed || sealed.v !== 1) throw new Error('Unsupported sealed credential version')
  const key = loadOrCreateMasterKey()
  const iv = Buffer.from(sealed.iv, 'base64url')
  const tag = Buffer.from(sealed.tag, 'base64url')
  const ciphertext = Buffer.from(sealed.ciphertext, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error('Invalid sealed credential metadata')
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(buildAad(profileId))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

function readVaultFile(): StoredVaultFile | null {
  const dir = resolveVaultDir()
  const filePath = path.join(dir, 'agent-models.enc.json')
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as StoredVaultFile
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.profiles)) return null
    return parsed
  } catch {
    return null
  }
}

function writeVaultFile(vault: StoredVaultFile): void {
  const dir = ensureVaultDir()
  const filePath = path.join(dir, 'agent-models.enc.json')
  const tmpFile = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmpFile, JSON.stringify(vault, null, 2), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(tmpFile, filePath)
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    // Ignore chmod failures on filesystems without POSIX permissions
  }
}

function isValidSealedCredential(sealed: SealedCredential | undefined): sealed is SealedCredential {
  return Boolean(sealed && sealed.v === 1 && sealed.iv && sealed.ciphertext && sealed.tag)
}

function sanitizeProfileForClient(record: StoredProfileRecord): AgentModelProfile {
  return {
    id: record.id,
    name: record.name,
    config: {
      ...record.config,
      apiKey: undefined,
      hasApiKey: isValidSealedCredential(record.sealedApiKey),
    },
    filter: record.filter,
  }
}

/** Lists all stored profiles without ever returning plaintext API keys. */
export function listStoredProfiles(): { profiles: AgentModelProfile[]; activeId: string } | null {
  const vault = readVaultFile()
  if (!vault || vault.profiles.length === 0) return null
  const profiles = vault.profiles.filter((item) => item?.config && item.config.provider in AGENT_PRESETS).map(sanitizeProfileForClient)
  if (profiles.length === 0) return null
  const activeId = profiles.some((p) => p.id === vault.activeId) ? vault.activeId : profiles[0].id
  return { profiles, activeId }
}

/** Saves or updates a profile, encrypting any newly provided API key at rest with AES-256-GCM. */
export function saveStoredProfile(profile: AgentModelProfile, options?: { clearApiKey?: boolean; setActive?: boolean }): { profiles: AgentModelProfile[]; activeId: string } {
  const existingVault = readVaultFile() || { v: 1 as const, activeId: profile.id, profiles: [] }
  const existingRecord = existingVault.profiles.find((item) => item.id === profile.id)

  const { apiKey, hasApiKey: _hasApiKey, ...cleanConfig } = profile.config
  const trimmedKey = apiKey?.trim()

  let sealedApiKey = existingRecord?.sealedApiKey
  if (options?.clearApiKey) {
    sealedApiKey = undefined
  } else if (trimmedKey) {
    sealedApiKey = sealCredential(trimmedKey, profile.id)
  }

  const nextRecord: StoredProfileRecord = {
    id: profile.id,
    name: profile.name,
    config: cleanConfig,
    filter: profile.filter,
    ...(sealedApiKey ? { sealedApiKey } : {}),
  }

  const nextProfiles = existingRecord ? existingVault.profiles.map((item) => (item.id === profile.id ? nextRecord : item)) : [...existingVault.profiles, nextRecord]

  const nextActiveId = options?.setActive !== false ? profile.id : existingVault.activeId || profile.id

  const nextVault: StoredVaultFile = {
    v: 1,
    activeId: nextActiveId,
    profiles: nextProfiles,
  }
  writeVaultFile(nextVault)
  return {
    profiles: nextProfiles.map(sanitizeProfileForClient),
    activeId: nextActiveId,
  }
}

export function deleteStoredProfile(profileId: string): { profiles: AgentModelProfile[]; activeId: string } {
  const existingVault = readVaultFile()
  if (!existingVault) return { profiles: [], activeId: '' }
  if (existingVault.profiles.length <= 1) {
    return {
      profiles: existingVault.profiles.map(sanitizeProfileForClient),
      activeId: existingVault.activeId,
    }
  }
  const nextProfiles = existingVault.profiles.filter((item) => item.id !== profileId)
  const nextActiveId = nextProfiles.some((p) => p.id === existingVault.activeId) ? existingVault.activeId : nextProfiles[0]?.id || ''
  writeVaultFile({
    v: 1,
    activeId: nextActiveId,
    profiles: nextProfiles,
  })
  return {
    profiles: nextProfiles.map(sanitizeProfileForClient),
    activeId: nextActiveId,
  }
}

export function setActiveStoredProfile(profileId: string): void {
  const existingVault = readVaultFile()
  if (!existingVault) return
  if (!existingVault.profiles.some((p) => p.id === profileId)) return
  writeVaultFile({ ...existingVault, activeId: profileId })
}

/** Decrypts a stored API key in server memory for outbound upstream requests only. */
export function resolveStoredApiKey(profileId: string): string | undefined {
  const vault = readVaultFile()
  if (!vault) return undefined
  const record = vault.profiles.find((item) => item.id === profileId)
  if (!record?.sealedApiKey) return undefined
  try {
    return openCredential(record.sealedApiKey, profileId)
  } catch {
    return undefined
  }
}
