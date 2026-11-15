import { normalizeRemote } from '@/lib/git/identity'

describe('normalizeRemote', () => {
  it('treats ssh, https, and embedded credentials as one repository', () => {
    const ssh = normalizeRemote('git@gitlab.com:group/ticket-janitor.git')
    const https = normalizeRemote('https://gitlab.com/group/ticket-janitor.git')
    const token = normalizeRemote('https://oauth2:secret@gitlab.com/group/ticket-janitor.git')
    expect(ssh?.key).toBe('gitlab.com/group/ticket-janitor')
    expect(https?.key).toBe(ssh?.key)
    expect(token?.key).toBe(ssh?.key)
    expect(https).toMatchObject({ kind: 'gitlab', name: 'ticket-janitor', httpsUrl: 'https://gitlab.com/group/ticket-janitor.git' })
    expect(token?.httpsUrl).not.toContain('secret')
  })

  it('marks github.com separately from other hosts', () => {
    expect(normalizeRemote('git@github.com:owner/review-agent.git')?.kind).toBe('github')
    expect(normalizeRemote('https://gitlab.example.com/team/app.git')?.kind).toBe('gitlab')
  })
})
