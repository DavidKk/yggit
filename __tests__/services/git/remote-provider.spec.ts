import { parseGitHubRepo } from '@/services/git/remote-provider'

describe('remote-provider', () => {
  it('correctly extracts owner and repo from various URL formats', () => {
    expect(parseGitHubRepo('https://github.com/DavidKk/yggit')).toEqual({
      owner: 'DavidKk',
      repo: 'yggit',
    })
    expect(parseGitHubRepo('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    })
    expect(parseGitHubRepo('git@github.com:vercel/next.js.git')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    })
    expect(parseGitHubRepo('torvalds/linux')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
    })
    expect(parseGitHubRepo('github.com/golang/go')).toEqual({
      owner: 'golang',
      repo: 'go',
    })
    expect(parseGitHubRepo('invalid-repo')).toBeNull()
  })
})
