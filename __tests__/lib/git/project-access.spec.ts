import {
  consolidateProjects,
  extractProjectRemotes,
  getRemoteCloudType,
  getWebUrl,
  hasSavedRemote,
  isPrivateRemote,
  projectDisplayName,
  projectOpenTarget,
  projectSource,
  uniqueLocalProject,
} from '@/lib/git/project-access'
import type { GitLogView, GitProjectView } from '@/lib/git/types'

const project: GitProjectView = {
  id: 'saved',
  name: 'ticket-janitor',
  group: '中文文件夹',
  host: 'github',
  localPath: '',
  httpsUrl: 'https://github.com/DavidKk/yggit.git',
  local: false,
  remote: true,
  authorized: false,
}

describe('project access', () => {
  it('absorbs a remote into its matching local directory across URL formats', () => {
    const local = { ...project, id: 'local', localPath: 'edge_one', httpsUrl: 'git@github.com:davidkk/YGGIT.git', local: true }
    const projects = consolidateProjects([project, local])
    expect(projects).toEqual([local])
    expect(hasSavedRemote(projects, project.httpsUrl)).toBe(true)
    expect(uniqueLocalProject(projects, project.httpsUrl)).toBe(local)
  })

  it('preserves multiple local directories for one remote without choosing one arbitrarily', () => {
    const one = { ...project, id: 'one', localPath: 'edge_one', local: true }
    const two = { ...one, id: 'two', localPath: 'edge_two' }
    const unrelated = { ...project, id: 'other', httpsUrl: 'https://github.com/other/yggit' }
    const projects = consolidateProjects([one, project, two, unrelated, { ...unrelated, id: 'duplicate' }])
    expect(projects).toEqual([one, two, unrelated])
    expect(uniqueLocalProject(projects, project.httpsUrl)).toBeUndefined()
  })
  it('opens a saved GitHub repo online without authorization or a clone', () => {
    expect(projectOpenTarget(project)).toBe(project.httpsUrl)
  })

  it('prefers the specific local source when linked', () => {
    expect(projectOpenTarget({ ...project, localPath: '/one/ticket-janitor' })).toBe('/one/ticket-janitor')
  })

  it('requires association for unsupported remote hosts', () => {
    expect(projectOpenTarget({ ...project, httpsUrl: 'https://gitlab.example.com/team/repo.git' })).toBe('')
  })

  it('identifies SSH, HTTPS, suffix and GitHub case variants without comparing names', () => {
    expect(hasSavedRemote([project], 'git@github.com:davidkk/YGGIT.git')).toBe(true)
    expect(hasSavedRemote([project], 'https://github.com/other/ticket-janitor')).toBe(false)
  })

  it('distinguishes same-name projects by path or remote namespace', () => {
    expect(projectSource(project)).toBe('github.com/DavidKk/yggit')
    expect(projectSource({ ...project, localPath: '/other/ticket-janitor' })).toBe('/other/ticket-janitor')
  })

  it('displays a directory name rather than its browser storage ID', () => {
    const view = { repo: 'edge_123', displayPath: 'ticket-janitor' } as GitLogView
    expect(projectDisplayName(view, [])).toBe('ticket-janitor')
    expect(projectDisplayName(view, [{ ...project, name: 'My project', localPath: view.repo }])).toBe('My project')
  })

  it('determines if a remote URL is private or public open-source', () => {
    expect(isPrivateRemote('https://github.com/DavidKk/yggit.git')).toBe(false)
    expect(isPrivateRemote('git@github.com:DavidKk/yggit.git')).toBe(false)
    expect(isPrivateRemote('https://gitlab.com/gitlab-org/gitlab.git')).toBe(false)
    expect(isPrivateRemote('https://git.internal-corp.com/team/repo.git')).toBe(true)
    expect(isPrivateRemote('git@git.internal.corp:fintech/service.git')).toBe(true)
    expect(isPrivateRemote('https://github.com/my-org/private-repo.git', true)).toBe(true)
    expect(isPrivateRemote('https://ghp_secret@github.com/my-org/repo.git')).toBe(true)
  })

  it('resolves clean web URLs for browser navigation', () => {
    expect(getWebUrl('https://github.com/DavidKk/yggit.git')).toBe('https://github.com/DavidKk/yggit')
    expect(getWebUrl('git@github.com:DavidKk/yggit.git')).toBe('https://github.com/DavidKk/yggit')
    expect(getWebUrl('https://git.internal.corp/repo.git')).toBe('https://git.internal.corp/repo')
  })

  it('extracts and classifies project remotes for cloud icons and dropdowns', () => {
    // 1. Single public remote
    const pubProject: GitProjectView = {
      ...project,
      httpsUrl: 'https://github.com/facebook/react.git',
    }
    const pubRemotes = extractProjectRemotes(pubProject)
    expect(pubRemotes).toHaveLength(1)
    expect(pubRemotes[0].isPrivate).toBe(false)
    expect(getRemoteCloudType(pubRemotes)).toBe('single-public')

    // 2. Single private remote
    const privProject: GitProjectView = {
      ...project,
      httpsUrl: 'https://git.internal-corp.com/team/janitor.git',
    }
    const privRemotes = extractProjectRemotes(privProject)
    expect(privRemotes).toHaveLength(1)
    expect(privRemotes[0].isPrivate).toBe(true)
    expect(getRemoteCloudType(privRemotes)).toBe('single-private')

    // 3. Multiple remotes (e.g. origin public + backup private)
    const multiProject: GitProjectView = {
      ...project,
      remotes: [
        { name: 'origin', url: 'https://github.com/DavidKk/yggit.git', isPrivate: false },
        { name: 'corp', url: 'https://git.internal-corp.com/team/yggit.git', isPrivate: true },
      ],
    }
    const multiRemotes = extractProjectRemotes(multiProject)
    expect(multiRemotes).toHaveLength(2)
    expect(getRemoteCloudType(multiRemotes)).toBe('mixed')
  })
})
