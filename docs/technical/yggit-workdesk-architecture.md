# Yggit Workdesk — 虚拟研发同事技术架构文档 (Technical Specification)

> 版本：V1.0  
> 日期：2026-11-21  
> 状态：方案定稿，待研发实施  
> 关联 PRD：[docs/prd/yggit-workdesk-virtual-teammate.md](../prd/yggit-workdesk-virtual-teammate.md)  
> 交互规范：[docs/ux/yggit-workdesk-ux.md](../ux/yggit-workdesk-ux.md)  
> 目录索引：[docs/README.md](../README.md)

---

## 1. 架构总览与双模执行模型

Yggit Workdesk 依托 Yggit 已有的 **Local-first 双模驱动引擎（Dual-Mode Architecture）**，使同一套检测算法、聚类规则与卡片状态能够透明运行于 Local（Node.js 本地守护进程）与 Edge（纯浏览器 Web）两种环境。

```text
                           +-----------------------------------------------+
                           |            Yggit Workdesk UI Layer            |
                           |  (/workdesk, /workdesk/tasks/:taskId, ...)    |
                           +-----------------------+-----------------------+
                                                   |
                   +-------------------------------+-------------------------------+
                   |                                                               |
     +-------------v-------------+                                   +-------------v-------------+
     |   Task & Cluster Engine   |                                   |  Agent Pill Context Bridge|
     |   (lib/workdesk/cluster)  |                                   |   (lib/agent/workdesk)    |
     +-------------+-------------+                                   +-------------+-------------+
                   |                                                               |
     +-------------v-------------+                                   +-------------v-------------+
     |    Finding Store & Cache  |                                   |  Portable Check Sanitizer |
     |   (lib/workdesk/storage)  |                                   |    (lib/workdesk/share)   |
     +-------------+-------------+                                   +-------------+-------------+
                   |
     +-------------v---------------------------------------------------------------+
     |                       Deterministic Git Detector Pipeline                   |
     |  [BranchSyncDetector]  [WorktreeDetector]  [MergeScenario]  [WorkflowNorm]  |
     +-------------------------------------+---------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
     +-------------v-------------+                   +-------------v-------------+
     |    LOCAL Mode (Node.js)   |                   |    EDGE Mode (Browser)    |
     | - Native Git CLI spawns   |                   | - isomorphic-git          |
     | - Direct filesystem I/O   |                   | - Web File System Access  |
     | - Persistence: data/store |                   | - Persistence: IndexedDB  |
     +---------------------------+                   +---------------------------+
```

### 1.1 双模运行能力矩阵与差异化降级

| 功能特性                 | LOCAL 模式 (Node.js 原生驱动)                                                  | EDGE 模式 (Web 浏览器驱动)                    | 降级与边界策略                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **默认分支快进安全检查** | 原生 `git rev-parse`, `git merge-base --is-ancestor`, `git status --porcelain` | `isomorphic-git` 遍历 commit 对象祖先图       | 行为完全对齐；EDGE 模式通过 commit 对象缓存加速                                       |
| **多 Worktree 状态巡检** | 读取 `.git/worktrees` 及物理磁盘各 Worktree 目录                               | **不支持跨物理目录访问**                      | EDGE 模式下优雅降级：仅检查当前已授权句柄目录下的活动工作区，其余标记为 `unavailable` |
| **多分支组合模拟预演**   | 原生 `git merge-tree --write-tree` (内存级无污染模拟)                          | `isomorphic-git` 内存树合并 (in-memory index) | 均在内存中计算，不改动用户工作区任何实际文件                                          |
| **持久化存储**           | 本地 `data/workdesk-store.json`                                                | 浏览器 IndexedDB (`yggit_workdesk_store`)     | 两端数据契约一致，具备离线持久能力                                                    |

---

## 2. 核心领域模型与 TypeScript 契约 (`lib/workdesk/types.ts`)

遵循数据对象四层分级：  
$$\text{Detector Result} \longrightarrow \text{Finding} \longrightarrow \text{WorkItem} \longrightarrow \text{WorkCard}$$

```typescript
/** Git 引用与提交标识 */
export interface GitRef {
  name: string
  oid?: string
}

/** 检查证据链条 */
export interface FindingEvidence {
  paths?: string[]
  commits?: string[]
  ruleId?: string
  step?: number
  details?: Record<string, unknown>
}

/** 原子检测结果 */
export interface Finding {
  id: string // 唯一标识 (例如 finding_20261121_001)
  fingerprint: string // 稳定去重指纹 (SHA-256)
  repoId: string // 仓库稳定标识 (Repo Identity)
  repoAlias: string // 显示名称 (如 Yggit)
  kind: 'sync' | 'merge' | 'workflow' | 'review' | 'custom'
  source: 'git' | 'rule' | 'agent'
  severity: 'blocking' | 'warning' | 'info'
  lifecycle: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  freshness: 'fresh' | 'stale' | 'unavailable'
  target?: GitRef
  sources?: GitRef[]
  scenarioId?: string
  evidence: FindingEvidence
  observedAt: number // 时间戳 (ms)
  baseCommitOid: string // 检测时基准 Commit Hash
  engineVersion: string
}

/** 卡片内部具体操作子项 (逐仓库/逐分支) */
export interface WorkItem {
  id: string
  cardId: string
  repoId: string
  repoAlias: string
  name: string // 如 master, feature/auth
  summary: string // 如 "远程领先，可安全快进"
  state: 'safe' | 'warn' | 'bad'
  findingIds: string[]
  commit?: string
  paths?: string[]
}

/** 看板主卡片 (一件可完成的 Git 工作) */
export interface WorkCard {
  id: string // 路由主键 (如 sync, worktree, merge)
  groupKey: string // 聚类归组 Key
  title: string // 任务标题 (如 "同步默认分支")
  summary: string // 简要描述
  scope: string // 范围摘要 (如 "5 个项目")
  iconName: string // 对应 react-icons 标识 (如 LuRefreshCw)
  categoryId: 'branch' | 'merge' | 'standard' | 'review' | string
  categorySource: 'rule' | 'agent' | 'user'
  state: 'prepared' | 'waiting' | 'running' | 'completed' | 'partial' | 'archived'
  itemIds: string[]
  hidden?: boolean // 用户是否手动移出工作台
  createdAt: number
  updatedAt: number
}

/** 可移植检查配方 (Portable Check Recipe) */
export interface CheckRecipe {
  version: 1
  title: string
  description?: string
  createdAt: number
  sourceSummary?: string
  repositories: Array<{
    alias: string
    identity: string // 正规化 remote URL / stable UUID
  }>
  checks: Array<{
    repoAlias: string
    type: 'sync' | 'merge' | 'workflow' | 'review'
    target?: GitRef
    sources?: GitRef[]
    order?: string[]
    ruleId?: string
  }>
}
```

---

## 3. 指纹算法与生命周期管理

### 3.1 稳定去重指纹 (Fingerprint Generation)

为了确保检测结果在多次扫描中具有稳定的同一性，`Finding.fingerprint` 采用对关键属性进行确定性排序后的 SHA-256 哈希：

$$\text{Fingerprint} = \text{SHA256}(\text{repoId} + \text{kind} + \text{target.name} + \text{sources.sort()} + \text{ruleId} + \text{evidence.paths.sort()})$$

**注意**：`baseCommitOid` 故意**不纳入**指纹生成，用于检测该 Finding 是否随着代码提交而变为 `stale`（过期）或 `resolved`（已解决）。

### 3.2 任务卡片生命周期状态机

```text
       [检测引擎启动]
             │
             ▼
     ┌───────────────┐   用户从工作台移除   ┌───────────────┐
     │   prepared    │ ─────────────────> │   archived    │
     └───────┬───────┘                    └───────┬───────┘
             │                                    │
             │ Agent 介入处理 / 执行操作           │ 代码产生新 Commit 变动
             ▼                                    ▼
     ┌───────────────┐                    ┌───────────────┐
     │    running    │                    │ 重新激活并检查 │
     └───────┬───────┘                    └───────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌───────────┐ ┌───────────┐
│ completed │ │  partial  │
└───────────┘ └───────────┘
```

- **归档复苏机制 (Un-archive Policy)**：当用户点击“从工作台移除卡片”时，卡片标记为 `hidden: true` 并归档；只有当其关联分支的 `HEAD OID` 发生实质性变动时，系统才允许重新激活评估，避免已关闭问题在无代码变动时反复打扰。

---

## 4. 确定性检测引擎 (Deterministic Detectors)

为了防止卡顿，检测引擎采用**分层调度（2-Tier Scan Pipeline）**：

```text
[ 进入工作台 ]
      │
      ├──> L1: 毫秒级轻量巡检 (Fast Pass)
      │      - 仅读取已缓存的 Ref OID 与本地 HEAD
      │      - 判定 Ahead / Behind / Cleanliness
      │      - 瞬间装载看板骨架
      │
      └──> L2: 深度按需模拟 (Deep Pass)
             - 仅在用户打开卡片或点击重新核查时触发
             - 执行 3-Way 树合并模拟、First-parent 拓扑遍历
             - 独立 Web Worker / 子进程执行，带超时与取消机制
```

### 4.1 默认分支快进同步判定 (`DefaultBranchSyncDetector`)

- **安全判定前置条件（全部满足方可标为 safe）**：
  1. 远程分支存在且为本地分支直接后继：$\text{merge-base}(\text{local}, \text{remote}) == \text{local OID}$；
  2. 本地工作树与暂存区完全干净（无未跟踪与未提交修改）；
  3. 该分支未被本地其他活动 Git Worktree 检出占用；
- **异常状态分支分流**：
  - 本地领先或双方分叉 $\rightarrow$ `state: 'bad'` (分叉需人工介入)；
  - 工作树脏污 $\rightarrow$ `state: 'warn'` (存在未提交修改)；
  - 检出锁定 $\rightarrow$ `state: 'warn'` (其他 Worktree 正在使用)。

### 4.2 多分支组合集成模拟 (`MultiBranchIntegrationScenario`)

用户手动指定主干基准（如 `master`）与分支序列 $[B_1, B_2, \dots, B_n]$：

1. **基准快照**：以 `master` 当前树对象 $T_0$ 为基准；
2. **逐步试合**：
   - 步骤 1：模拟 $M_1 = \text{merge}(T_0, B_1)$；若产生文件冲突，记录步骤 1 冲突文件，终止链条并输出证据；
   - 步骤 2：以 $M_1$ 为基准模拟 $M_2 = \text{merge}(M_1, B_2)$；若产生文件冲突，记录步骤 2 冲突文件，明确指出是组合引入；
3. **零污染保证**：全部在 Git 虚拟树对象中完成（Local 使用 `git merge-tree`，Edge 使用 in-memory tree builder），用户磁盘工作区不产生任何锁与中间文件。

---

## 5. 路由、视图映射与深链跳转规范

### 5.1 Next.js App Router 路由拓扑

```text
app/(workspace)/
  ├── workdesk/
  │     ├── page.tsx                     // /workdesk 看板首页
  │     └── tasks/
  │           └── [taskId]/
  │                 ├── page.tsx         // /workdesk/tasks/:taskId
  │                 └── items/
  │                       └── [itemId]/
  │                             └── page.tsx // /workdesk/tasks/:taskId/items/:itemId
  └── import/
        └── page.tsx                     // /import Portable Check 导入
```

> **设计决策**：`tasks/[taskId]/page.tsx` 与 `items/[itemId]/page.tsx` 复用同一个左右分栏客户端组件 `WorkdeskTaskDetailView`，通过 URL 驱动左侧选中态与右侧证据展示，保证路由直达、无闪烁刷新与前进后退支持。

### 5.2 现有 Git 深度链接映射 (Deep Links)

当用户在任务右侧证据列表中点击链接时，系统通过标准路由协议跳转进入 Yggit 原生工作区：

| 证据类型        | 目标路由         | 传递参数                    | 现有组件承载行为                                                  |
| --------------- | ---------------- | --------------------------- | ----------------------------------------------------------------- |
| **Commit 节点** | `/git/[...slug]` | `?commit=[oid]&focus=true`  | 进入 `GitLogPage`，有机贝塞尔图谱自动平滑滚动并高亮该 Commit 节点 |
| **文件差异**    | `/git/[...slug]` | `?file=[path]&diff=true`    | 唤起 `GitFileDiff` 侧边浮层，呈现 Side-by-side 文件对比           |
| **冲突分析**    | `/git/[...slug]` | `?conflict=true&base=[oid]` | 唤起 `GitConflict3Way`，展示三方冲突标记与自动合并分析            |

---

## 6. Agent 药丸联动与操作守卫架构

### 6.1 上下文注入协议 (`WorkdeskContextPayload`)

当在任务详情中展开 Agent 侧栏时，前端注入结构化 Context：

```typescript
export interface WorkdeskContextPayload {
  source: 'workdesk'
  taskId: string
  taskTitle: string
  activeItemId?: string
  repoIdentity: string
  repoAlias: string
  targetRef?: string
  evidenceCommits: string[]
  evidencePaths: string[]
  state: 'safe' | 'warn' | 'bad'
  summary: string
}
```

Agent Runtime 根据该 Payload 自动装填 System Prompt，使用户无需输入废话即可开始技术对话。

### 6.2 写操作执行守卫 (Action Execution Guard)

Agent 不得绕过前端直接静默修改 Git 仓库。所有写操作必须遵循三阶段校验：

1. **意图准备 (Prepare)**：Agent 生成明确动作清单（如 `FastForwardBranchAction`）；
2. **前置条件验证 (Verify Preconditions)**：再次读取仓库当前 `HEAD OID` 与工作树状态；若与准备时出现偏差，直接中止并告警；
3. **用户显式授权 (User Approval)**：在 Agent 侧栏或界面确认弹框中由用户点击批准，方可调用本地驱动执行；执行后刷新 Finding 状态并回写任务卡片。

---

## 7. Portable Check (检查方案分享) 协议规范

### 7.1 载荷编解码与限制

- **编码格式**：
  $$\text{Payload} = \text{Base64URL}(\text{PakoGzip}(\text{JSON.stringify(CheckRecipe)}))$$
- **体积预算**：
  - URL Hash (`#data=...`) 适用于压缩后 $\le 2 \text{ KB}$ 的配方；
  - 若超过 $2 \text{ KB}$，降级为导出 `.yggit-check` JSON 文件。
- **安全沙箱**：
  - 纯声明式 JSON，严禁夹带任何可执行脚本、Shell 命令或未授权的外部 Skill 引用；
  - 严格限制 `repositories` 数量 $\le 30$，`checks` 数量 $\le 100$。

### 7.2 仓库身份匹配算法 (`RepoMatcher`)

接收端通过多层策略匹配本地项目：

1. **精确 Remote URL 匹配**：对 Git Remote 地址进行正规化处理（统一去除 `.git` 后缀、协议前缀转化为标准形式），匹配本地已授权仓库的 Remotes；
2. **稳定 Identity 匹配**：若匹配失败，通过仓库内特有的稳定 UUID（若已生成）匹配；
3. **交互式手动关联**：未匹配成功的仓库，在导入界面提供下拉选择器，由用户指定本地目录或拉取新仓库完成绑定。

---

## 8. 实施里程碑与验证计划

- **Milestone 1 (Domain & Storage)**：落地 `lib/workdesk/types.ts` 与双模存储适配器；
- **Milestone 2 (Detectors & Pipeline)**：实现默认分支快进与工作区健康检测器，接入本地 Git CLI 驱动；
- **Milestone 3 (UI Board & Detail View)**：实现自适应四列看板、左右分栏详情页与深链定位；
- **Milestone 4 (Agent Pill & Portable Check)**：打通 Agent 上下文联动与 URL 配方导入导出。
