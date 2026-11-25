# Yggit — 多项目智能分组分类与仓库治理技术架构文档 (Technical Specification)

> 版本：V1.0  
> 日期：2026-11-22  
> 状态：方案定稿，分步实施  
> 关联 PRD：[docs/prd/yggit-project-categorization-and-governance.md](../prd/yggit-project-categorization-and-governance.md)  
> 目录索引：[docs/README.md](../README.md)

---

## 1. 架构总览与执行流拓扑

系统依托 Yggit 的 **Local-first 双模驱动模型** 和 **Workdesk 确定性检测管线**，实现“程序负责可靠发现，Agent 负责理解与协助”的完整闭环。

```text
                           +-----------------------------------------------+
                           |          Workdesk & Global UI Layer           |
                           |   (WorkdeskBoard / WorkspaceHeader Switcher)  |
                           +-----------------------+-----------------------+
                                                   |
                   +-------------------------------+-------------------------------+
                   |                                                               |
     +-------------v-------------+                                   +-------------v-------------+
     |   Workdesk Detect Engine  |                                   |     Agent Runtime Host    |
     | (OrganizationDetector)   |                                   |    (WorkdeskContextBridge)|
     +-------------+-------------+                                   +-------------+-------------+
                   |                                                               |
     +-------------v-------------+                                   +-------------v-------------+
     |   Finding / Card Cluster  |                                   |  project-categorizer Skill|
     | (standard:project-org)    |                                   | (Heuristics + LLM Schema) |
     +-------------+-------------+                                   +-------------+-------------+
                   |                                                               |
                   +-------------------------------+-------------------------------+
                                                   | User Approval
                                                   v
                                     +---------------------------+
                                     |   Execution Guard Action  |
                                     |   (Atomic Batch Driver)   |
                                     +-------------+-------------+
                                                   |
                         +-------------------------+-------------------------+
                         |                                                   |
           +-------------v-------------+                       +-------------v-------------+
           |    LOCAL Mode (Node.js)   |                       |    EDGE Mode (Browser)    |
           | - POST /api/git/projects  |                       | - EdgeGitDriver methods   |
           | - data/git-projects.json  |                       | - IndexedDB: projects     |
           +---------------------------+                       +---------------------------+
```

---

## 2. 领域模型与 TypeScript 契约

### 2.1 组织治理 Finding 证据契约 (`FindingEvidence`)

在 `lib/workdesk/types.ts` 的 `FindingEvidence` 中定义组织度专有字段：

```typescript
export interface ProjectOrgEvidenceDetails {
  groupName: string
  projectCount: number
  samplePaths: string[]
  sampleRemotes: string[]
  detectedClusters: Array<{
    suggestedGroup: string
    projectIds: string[]
    reason: string
  }>
  conclusion: string
  stateKind: 'safe' | 'warn' | 'bad'
}
```

### 2.2 Agent 分组方案数据结构 (`ProjectGroupingPlan`)

```typescript
export interface GroupingMoveAction {
  projectId: string
  projectName: string
  currentGroup: string
  targetGroup: string
  reason: string
}

export interface ProjectGroupingPlan {
  version: 1
  createdAt: number
  sourceGroupName: string
  totalProjects: number
  newGroupsToCreate: string[]
  actions: GroupingMoveAction[]
}
```

---

## 3. 确定性检测算法 (`OrganizationHygieneDetector`)

### 3.1 规则算法 (`lib/workdesk/detectors/organization-hygiene.ts`)

为了防止无意义告警，算法对每个分组进行**堆叠度与熵值检测**：

```typescript
export function detectOrganizationHygiene(projects: GitProjectView[]): Finding[] {
  const findings: Finding[] = []
  const groupMap = new Map<string, GitProjectView[]>()

  // 1. 按分组聚合
  for (const project of projects) {
    const group = project.group || '个人项目'
    if (!groupMap.has(group)) groupMap.set(group, [])
    groupMap.get(group)!.push(project)
  }

  // 2. 巡检各分组的堆叠情况
  for (const [groupName, groupProjects] of groupMap.entries()) {
    // 阈值：项目数 >= 10
    if (groupProjects.length < 10) continue

    // 提取公共路径前缀多样性
    const distinctRoots = new Set<string>()
    for (const p of groupProjects) {
      if (p.localPath) {
        // 取倒数第 2 级目录作为父命名空间（如 /Develop/backend/admin -> backend）
        const parts = p.localPath.split('/').filter(Boolean)
        if (parts.length >= 2) {
          distinctRoots.add(parts[parts.length - 2])
        }
      }
    }

    // 若父目录存在 2 个以上不同业务目录，表明存在多业务域混杂
    if (distinctRoots.size >= 2) {
      const fingerprint = generateFindingFingerprint({
        repoIdentity: `org_group_${encodeURIComponent(groupName)}`,
        kind: 'custom',
        ruleId: 'project-organization-hygiene',
        targetRef: groupName,
      })

      findings.push({
        id: `finding_org_${encodeURIComponent(groupName)}`,
        fingerprint,
        repoId: 'global',
        repoAlias: groupName,
        kind: 'custom',
        source: 'rule',
        severity: 'info',
        lifecycle: 'open',
        freshness: 'fresh',
        target: { name: groupName },
        scenarioId: 'project-organization',
        evidence: {
          paths: Array.from(distinctRoots),
          ruleId: 'project-organization-hygiene',
          details: {
            groupName,
            projectCount: groupProjects.length,
            samplePaths: groupProjects.slice(0, 5).map((p) => p.localPath),
            conclusion: `分组「${groupName}」堆叠了 ${groupProjects.length} 个项目，且涵盖 ${distinctRoots.size} 个不同物理目录前缀，建议按模块智能整理`,
            stateKind: 'warn',
          },
        },
        observedAt: Date.now(),
        baseCommitOid: '',
        engineVersion: '1.0.0',
      })
    }
  }

  return findings
}
```

---

## 4. 智能聚类引擎与 Agent Skill 实现

### 4.1 聚类启发式管线 (Four-Tier Taxonomy Pipeline)

Agent Skill 采用**启发式优先 + LLM 语义润色**的双阶管线：

1. **Tier 1 (物理路径聚类 - Filesystem Path Tree)**：
   - 提取各项目的绝对路径层次，计算最长公共父路径（LCP）；
   - 例如：
     - `/Users/.../Develop/backend/*` $\rightarrow$ 候选簇：`backend`
     - `/Users/.../Develop/sl/*` $\rightarrow$ 候选簇：`sl`
     - `/Users/.../Develop/ops/*` $\rightarrow$ 候选簇：`ops`
     - `/Users/.../Develop/worktree/*` $\rightarrow$ 候选簇：`worktree`
2. **Tier 2 (远端命名空间匹配 - Remote Namespace)**：
   - 解析 Git Remote URL 路径中的组名：
     - `git.example.com/org/team/website/backend/*` $\rightarrow$ 关联后端
     - `git.example.com/org/team/website/frontend/*` $\rightarrow$ 关联前端
3. **Tier 3 (技术栈与工程类型识别 - Stack Signatures)**：
   - 识别特殊仓库类型：
     - 包含 `api`, `bff`, `service`, `grpc` $\rightarrow$ 业务后端服务
     - 包含 `plugin`, `component`, `library`, `editor`, `fe` $\rightarrow$ 前端组件与插件
     - 包含 `test`, `mock`, `runner` $\rightarrow$ 测试与运行沙箱
4. **Tier 4 (LLM 命名优化与映射)**：
   - 将机械的目录名转换为用户友好的组织分组名：
     - `backend` $\rightarrow$ `后端微服务`
     - `frontend` (前端) $\rightarrow$ `前端与组件`
     - `ops` $\rightarrow$ `基础架构与运维`
     - `worktree` $\rightarrow$ `独立工作树与实验`

### 4.2 Agent 技能工具契约 (`project-organizer`)

为 Agent 注册两个专有原子 Tool：

```typescript
// 1. 获取分析元数据
{
  name: 'analyze_project_groups',
  description: '读取当前所有未分类或堆叠项目的详细路径、Remote 与类型分布，生成多维度分组方案',
  parameters: {
    type: 'object',
    properties: {
      sourceGroup: { type: 'string', description: '待分析的目标分组名称（默认分析所有项目）' }
    }
  }
}

// 2. 批量应用分组方案
{
  name: 'apply_project_grouping',
  description: '原子批量创建新分组并移动项目至对应分组中',
  parameters: {
    type: 'object',
    properties: {
      groupsToCreate: { type: 'array', items: { type: 'string' } },
      moves: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            targetGroup: { type: 'string' }
          },
          required: ['projectId', 'targetGroup']
        }
      }
    },
    required: ['moves']
  }
}
```

---

## 5. 写操作执行守卫与原子性保证 (Execution Guard)

### 5.1 守卫生命周期流转

```text
[ 用户发起 / 唤起卡片 ]
          │
          ▼
  [ Agent 生成方案预览 ] ── 包含分组对比表与操作清单
          │
          ▼
   [ 用户点击确认应用 ]
          │
          ▼
 [ 本地执行端校验与写入 ]
    1. 校验目标项目 ID 依然存在且未被删除
    2. 校验目标分组名规范（无非法字符、无路径穿越）
    3. 顺序调用 driver.createFolder 确保目标文件夹创建完成
    4. 并发/批量调用 driver.moveProject 更新归属组
          │
          ▼
   [ 全局广播与轻量重检 ]
    1. 触发 ProjectCatalog 状态变更事件
    2. Workdesk 重新扫描，原堆叠 Finding 状态转为 resolved
    3. 卡片从看板收起
```

### 5.2 失败容错与幂等性

- `createFolder` 具备幂等性：如果分组已存在，忽略错误直接复用；
- `moveProject` 逐项执行时若遇单项失败，记录失败项并继续迁移其他项，最终向用户输出成功与失败汇总；
- 严禁任何跨进程系统命令（如 `child_process.exec('mv ...')`），仅更新内部目录元数据 `GitProjectCatalog`，确保绝对安全。

---

## 6. 双模支持与持久化规范

| 驱动模式       | 文件夹持久化机制                            | 项目移动持久化机制                     | 适用环境            |
| :------------- | :------------------------------------------ | :------------------------------------- | :------------------ |
| **LOCAL 模式** | Node.js 读写 `<APP_DATA>/git-projects.json` | 更新 `projects[].group` 并重写 catalog | 本地桌面 / CLI 模式 |
| **EDGE 模式**  | 浏览器 IndexedDB `yggit_project_catalog`    | 更新 IndexedDB 对象库记录              | 纯 Web / 离线模式   |

---

## 7. 测试与验证计划

1. **单元测试 (`__tests__/lib/workdesk/organization-hygiene.spec.ts`)**：
   - 验证少于 10 个项目时不产生 Finding；
   - 验证 61 个同组且路径分散的项目时准确输出堆叠 Finding 与证据；
   - 验证分组重构后重新扫描，Finding 正确标记为 `resolved`。
2. **聚类与技能测试 (`__tests__/lib/agent/project-categorizer.spec.ts`)**：
   - 验证路径前缀抽取与 Remote 命名空间解析精度；
   - 验证批量 `apply_project_grouping` 在 Local / Edge 双模下的幂等与状态更新。
3. **冒烟集成验证**：
   - 启动本地服务，加载 61 个项目，确认看板「研发规范」显示卡片；
   - 点击确认执行后，验证左上角下拉菜单成功展现分类文件夹。
