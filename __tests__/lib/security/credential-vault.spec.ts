import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { deleteStoredProfile, listStoredProfiles, openCredential, resolveStoredApiKey, saveStoredProfile, sealCredential } from '@/lib/security/credential-vault'

describe('credential-vault', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yggit-vault-test-'))
    process.env.YGGIT_VAULT_DIR = tmpDir
  })

  afterEach(() => {
    delete process.env.YGGIT_VAULT_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('seals and opens credentials with AES-256-GCM and AAD bound to profileId', () => {
    const sealed = sealCredential('sk-secret-token-1234', 'profile-a')
    expect(sealed.v).toBe(1)
    expect(sealed.ciphertext).not.toContain('sk-secret-token-1234')
    expect(openCredential(sealed, 'profile-a')).toBe('sk-secret-token-1234')
    expect(() => openCredential(sealed, 'profile-b')).toThrow()
  })

  it('persists encrypted profiles on disk without plaintext and never returns apiKey in listStoredProfiles', () => {
    saveStoredProfile({
      id: 'magpie-1',
      name: 'Magpie Local',
      config: {
        provider: 'magpie',
        model: 'codex/gpt-6.1-sol',
        baseUrl: 'http://127.0.0.1:3425/v1',
        apiKey: 'magpie-live-secret-999',
      },
    })

    const vaultFile = fs.readFileSync(path.join(tmpDir, 'agent-models.enc.json'), 'utf8')
    expect(vaultFile).not.toContain('magpie-live-secret-999')

    const listed = listStoredProfiles()!
    expect(listed.activeId).toBe('magpie-1')
    expect(listed.profiles).toHaveLength(1)
    expect(listed.profiles[0].config.apiKey).toBeUndefined()
    expect(listed.profiles[0].config.hasApiKey).toBe(true)

    expect(resolveStoredApiKey('magpie-1')).toBe('magpie-live-secret-999')

    // Updating metadata without passing apiKey preserves existing sealed credential
    saveStoredProfile({
      id: 'magpie-1',
      name: 'Magpie Updated',
      config: {
        provider: 'magpie',
        model: 'codex/gpt-6.1-sol',
        baseUrl: 'http://127.0.0.1:3425/v1',
        hasApiKey: true,
      },
    })
    expect(resolveStoredApiKey('magpie-1')).toBe('magpie-live-secret-999')

    // Clearing apiKey removes the sealed credential
    saveStoredProfile(
      {
        id: 'magpie-1',
        name: 'Magpie Cleared',
        config: {
          provider: 'magpie',
          model: 'codex/gpt-6.1-sol',
          baseUrl: 'http://127.0.0.1:3425/v1',
        },
      },
      { clearApiKey: true }
    )
    expect(resolveStoredApiKey('magpie-1')).toBeUndefined()
    expect(listStoredProfiles()!.profiles[0].config.hasApiKey).toBe(false)

    // Delete requires >1 profile, so add another then delete magpie-1
    saveStoredProfile({
      id: 'backup-1',
      name: 'Backup',
      config: { provider: 'ollama', model: 'qwen2.5-coder', baseUrl: 'http://localhost:11434/v1' },
    })
    const afterDelete = deleteStoredProfile('magpie-1')
    expect(afterDelete.profiles.map((p) => p.id)).toEqual(['backup-1'])
  })
})
