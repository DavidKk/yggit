import { driverModeFromPathname, isLocalModePathname, stripLocalPrefix, withDriverModePath } from '@/lib/git/route-mode'
import { isAllowedAgentPath } from '@/lib/security/agent-paths'

describe('route-mode helpers', () => {
  it('detects /local prefix and resolves driver mode strictly from pathname', () => {
    expect(isLocalModePathname('/')).toBe(false)
    expect(isLocalModePathname('/git')).toBe(false)
    expect(isLocalModePathname('/local')).toBe(true)
    expect(isLocalModePathname('/local/git')).toBe(true)
    expect(isLocalModePathname('/local/workdesk')).toBe(true)

    expect(driverModeFromPathname('/')).toBe('edge')
    expect(driverModeFromPathname('/git/github/owner/repo')).toBe('edge')
    expect(driverModeFromPathname('/workdesk')).toBe('edge')
    expect(driverModeFromPathname('/local')).toBe('local')
    expect(driverModeFromPathname('/local/git')).toBe('local')
    expect(driverModeFromPathname('/local/settings/models')).toBe('local')
  })

  it('strips and prefixes /local cleanly while leaving external and api paths untouched', () => {
    expect(stripLocalPrefix('/local')).toBe('/')
    expect(stripLocalPrefix('/local?foo=1')).toBe('/?foo=1')
    expect(stripLocalPrefix('/local/git/repo?file=a')).toBe('/git/repo?file=a')
    expect(stripLocalPrefix('/git/repo')).toBe('/git/repo')

    expect(withDriverModePath('/git', 'edge')).toBe('/git')
    expect(withDriverModePath('/local/git', 'edge')).toBe('/git')
    expect(withDriverModePath('/git', 'local')).toBe('/local/git')
    expect(withDriverModePath('/local/git', 'local')).toBe('/local/git')
    expect(withDriverModePath('/', 'local')).toBe('/local')
    expect(withDriverModePath('/?repo=1', 'local')).toBe('/local?repo=1')
    expect(withDriverModePath('/api/git/log', 'local')).toBe('/api/git/log')
    expect(withDriverModePath('https://github.com/owner/repo', 'local')).toBe('https://github.com/owner/repo')
  })

  it('allows Agent endpoints on both Edge and /local prefixed workspace paths', () => {
    expect(isAllowedAgentPath('/git')).toBe(true)
    expect(isAllowedAgentPath('/local/git')).toBe(true)
    expect(isAllowedAgentPath('/local/settings/models/new')).toBe(true)
    expect(isAllowedAgentPath('/local/workdesk')).toBe(true)
    expect(isAllowedAgentPath('/')).toBe(false)
    expect(isAllowedAgentPath('/local')).toBe(false)
  })
})
