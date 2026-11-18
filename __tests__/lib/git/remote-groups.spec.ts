import { listRemoteGroup, remoteGroupLocation } from '@/lib/git/remote-groups'

const originalFetch = global.fetch
const reply = (data: unknown, headers: Record<string, string> = {}, status = 200) =>
  ({ ok: status < 400, status, headers: new Headers(headers), json: async () => data }) as Response
const repo = (id: number) => ({ id, name: `repo-${id}`, http_url_to_repo: `https://git.example.com/team/repo-${id}.git` })
afterEach(() => {
  global.fetch = originalFetch
})

it('encodes nested GitLab groups and reads every page before returning', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(reply([repo(1)], { 'x-next-page': '2' }))
    .mockResolvedValueOnce(reply([repo(2)], { 'x-next-page': '' }))
  global.fetch = fetcher
  const result = await listRemoteGroup({ provider: 'gitlab', url: 'https://git.example.com/groups/team/sub', token: 'private-token' })
  expect(result.map((item) => item.name)).toEqual(['repo-1', 'repo-2'])
  expect(fetcher.mock.calls[0][0]).toContain('/groups/team%2Fsub/projects?include_subgroups=true')
  expect(fetcher.mock.calls[1][0]).toContain('page=2')
  expect(fetcher.mock.calls[0][1].headers['PRIVATE-TOKEN']).toBe('private-token')
})

it('uses the Enterprise API and GitHub authorization scheme', async () => {
  global.fetch = jest.fn().mockResolvedValue(reply([{ id: 1, name: 'app', clone_url: 'https://github.example.com/org/app.git' }]))
  expect(remoteGroupLocation({ provider: 'github', url: 'https://github.com/org' }).api).toBe('https://api.github.com')
  await listRemoteGroup({ provider: 'github', url: 'https://github.example.com/org', token: 'secret' })
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('https://github.example.com/api/v3/orgs/org/repos'),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret' }) })
  )
})

it('rejects failed pages without returning a partial import or leaking the token', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(reply([repo(1)], { 'x-next-page': '2' }))
    .mockRejectedValueOnce(new Error('private-token'))
  await expect(listRemoteGroup({ provider: 'gitlab', url: 'https://git.example.com/team', token: 'private-token' })).rejects.toThrow('REMOTE_GROUP_NETWORK_ERROR')
})

it('rejects repeated pages and clone URLs on a different host', async () => {
  global.fetch = jest.fn().mockResolvedValue(reply([repo(1)], { 'x-next-page': '2' }))
  await expect(listRemoteGroup({ provider: 'gitlab', url: 'https://git.example.com/team' })).rejects.toThrow('REMOTE_GROUP_REPEATED_PAGE')
  global.fetch = jest.fn().mockResolvedValue(reply([{ ...repo(1), http_url_to_repo: 'https://other.example/repo.git' }]))
  await expect(listRemoteGroup({ provider: 'gitlab', url: 'https://git.example.com/team' })).rejects.toThrow('REMOTE_GROUP_INVALID_RESPONSE')
})
