/**
 * @jest-environment jsdom
 */
import { addTemporaryRepo, getTemporaryRepos, parseRemoteUrl, removeTemporaryRepo } from '@/lib/git/temporary-store'

describe('temporary-store', () => {
  beforeEach(() => {
    // Mock sessionStorage
    const store: Record<string, string> = {}
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          delete store[k]
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k]
        },
      },
      writable: true,
    })
  })

  it('parses https and ssh GitHub URLs and shorthands', () => {
    const res1 = parseRemoteUrl('https://github.com/facebook/react.git')
    expect(res1).not.toBeNull()
    expect(res1?.name).toBe('facebook/react')
    expect(res1?.provider).toBe('github')

    const res2 = parseRemoteUrl('git@github.com:DavidKk/yggit.git')
    expect(res2).not.toBeNull()
    expect(res2?.name).toBe('DavidKk/yggit')
    expect(res2?.provider).toBe('github')

    const res3 = parseRemoteUrl('vercel/next.js')
    expect(res3).not.toBeNull()
    expect(res3?.name).toBe('vercel/next.js')
    expect(res3?.remoteUrl).toBe('https://github.com/vercel/next.js.git')

    const resInvalid = parseRemoteUrl('not a repo')
    expect(resInvalid).toBeNull()
  })

  it('adds and removes temporary repositories in session storage', () => {
    const parsed = parseRemoteUrl('https://github.com/DavidKk/yggit')!
    const added = addTemporaryRepo(parsed)
    expect(added.id).toContain('temp_')
    expect(getTemporaryRepos()).toHaveLength(1)
    expect(getTemporaryRepos()[0].name).toBe('DavidKk/yggit')

    // Avoid duplicate addition
    addTemporaryRepo(parsed)
    expect(getTemporaryRepos()).toHaveLength(1)

    // Remove
    removeTemporaryRepo(added.id)
    expect(getTemporaryRepos()).toHaveLength(0)
  })
})
