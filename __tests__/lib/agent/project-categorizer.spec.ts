import { classifyProjects, determineTargetGroup } from '@/lib/agent/project-categorizer'
import type { GitProjectView } from '@/lib/git/types'

describe('Project Categorizer Engine', () => {
  it('correctly categorizes worktree and playground environments', () => {
    const proj: GitProjectView = {
      id: 'p1',
      name: 'test',
      group: '个人项目',
      host: 'local',
      localPath: '/Users/davidjones/Develop/worktree/test',
      httpsUrl: '',
      local: true,
      remote: false,
      authorized: true,
    }

    const { targetGroup } = determineTargetGroup(proj)
    expect(targetGroup).toBe('独立工作树与实验')
  })

  it('correctly categorizes backend microservices and APIs', () => {
    const proj: GitProjectView = {
      id: 'p2',
      name: 'order-tracking-api',
      group: '个人项目',
      host: 'gitlab',
      localPath: '/Users/davidjones/Develop/backend/order-tracking-api',
      httpsUrl: 'https://git.example.com/org/team/website/backend/order-tracking-api.git',
      local: true,
      remote: true,
      authorized: true,
    }

    const { targetGroup } = determineTargetGroup(proj)
    expect(targetGroup).toBe('后端微服务')
  })

  it('correctly categorizes frontend apps and editors', () => {
    const proj: GitProjectView = {
      id: 'p3',
      name: 'cloudframe-editor',
      group: '个人项目',
      host: 'gitlab',
      localPath: '/Users/davidjones/Develop/frontend/cloudframe-editor',
      httpsUrl: 'https://git.example.com/org/team/website/frontend/cloudframe-editor.git',
      local: true,
      remote: true,
      authorized: true,
    }

    const { targetGroup } = determineTargetGroup(proj)
    expect(targetGroup).toBe('前端应用与编辑器')
  })

  it('correctly categorizes frontend plugins and component libraries', () => {
    const proj: GitProjectView = {
      id: 'p4',
      name: 'Advanced-Component-library',
      group: '个人项目',
      host: 'gitlab',
      localPath: '/Users/davidjones/Develop/frontend/Advanced-Component-library',
      httpsUrl: 'https://git.example.com/org/team/website/frontend/Advanced-Component-library.git',
      local: true,
      remote: true,
      authorized: true,
    }

    const { targetGroup } = determineTargetGroup(proj)
    expect(targetGroup).toBe('插件与扩展组件')
  })

  it('correctly categorizes ops and infrastructure repositories', () => {
    const proj: GitProjectView = {
      id: 'p5',
      name: 'yggdrasil',
      group: '个人项目',
      host: 'github',
      localPath: '/Users/davidjones/Develop/ops/apps/yggdrasil',
      httpsUrl: 'https://github.com/DavidKk/yggit.git',
      local: true,
      remote: true,
      authorized: true,
    }

    const { targetGroup } = determineTargetGroup(proj)
    expect(targetGroup).toBe('基础架构与运维')
  })

  it('generates a complete ProjectGroupingPlan with distinct new groups to create', () => {
    const projects: GitProjectView[] = [
      {
        id: '1',
        name: 'test',
        group: '个人项目',
        host: 'local',
        localPath: '/Users/davidjones/Develop/worktree/test',
        httpsUrl: '',
        local: true,
        remote: false,
        authorized: true,
      },
      {
        id: '2',
        name: 'admin',
        group: '个人项目',
        host: 'gitlab',
        localPath: '/Users/davidjones/Develop/backend/admin',
        httpsUrl: 'https://git.example.com/org/team/website/backend/admin.git',
        local: true,
        remote: true,
        authorized: true,
      },
      {
        id: '3',
        name: 'yggdrasil',
        group: '个人项目',
        host: 'github',
        localPath: '/Users/davidjones/Develop/ops/apps/yggdrasil',
        httpsUrl: 'https://github.com/DavidKk/yggit.git',
        local: true,
        remote: true,
        authorized: true,
      },
      {
        id: '4',
        name: 'custom-code-plugin',
        group: '个人项目',
        host: 'gitlab',
        localPath: '/Users/davidjones/Develop/frontend/custom-code-plugin',
        httpsUrl: 'https://git.example.com/org/team/website/frontend/custom-code-plugin.git',
        local: true,
        remote: true,
        authorized: true,
      },
    ]

    const plan = classifyProjects(projects, '个人项目')
    expect(plan.totalProjects).toBe(4)
    expect(plan.actions).toHaveLength(4)
    expect(plan.newGroupsToCreate).toEqual(expect.arrayContaining(['独立工作树与实验', '后端微服务', '基础架构与运维', '插件与扩展组件']))
  })
})
