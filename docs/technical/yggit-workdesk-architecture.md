# Yggit Workdesk — 虚拟研发同事技术架构文档 (Technical Specification)

> 版本：V1.0  
> 日期：2026-11-21  
> 状态：需求评审中，待确认项见 PRD §9
>
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

| 功能特性                        | LOCAL 模式 (Node.js 原生驱动)                                                  | EDGE 模式 (Web 浏览器驱动)                    | 降级与边界策略                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| **默认分支快进安全检查**        | 原生 `git rev-parse`、`git merge-base --is-ancestor`、`git status --porcelain` | `isomorphic-git` 读取已授权目录的提交和工作树 | 缺少最新远端引用或祖先对象时标记为待核查。双模刷新策略见 §4                           |
| **多 Worktree 状态巡检**        | 读取 `.git/worktrees` 及物理磁盘各 Worktree 目录                               | **不支持跨物理目录访问**                      | EDGE 模式下优雅降级：仅检查当前已授权句柄目录下的活动工作区，其余标记为 `unavailable` |
| **跨分支集成结果核对（P0 后）** | 读取本地提交、文件 Diff 和已有冲突证据                                         | 读取已授权目录中可用的提交与文件对象          | 依据固定快照核对结果。缺少可比证据时标记为待核查                                      |
| **持久化存储**                  | 本地 `data/workdesk-store.json`                                                | 浏览器 IndexedDB (`yggit_workdesk_store`)     | 两端数据契约一致，具备离线持久能力                                                    |

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
  details?: Record<string, unknown>
}

/** 原子检测结果 */
export interface Finding {
  id: string // 唯一标识 (例如 finding_20261121_001)
  fingerprint: string // 稳定去重指纹 (SHA-256)
  repoId: string // 仓库稳定标识 (Repo Identity)
  repoAlias: string // 显示名称 (如 Yggit)
  kind: 'sync' | 'merge' | 'review' | 'custom'
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
  repositories: Array<{
    identityDigest: string
  }>
  checks: Array<{
    repoIdentityDigest: string
    type: 'sync' | 'merge' | 'review'
    target?: string
    sources?: string[]
    ruleId?: string
  }>
}
```

---

## 3. 指纹算法与生命周期管理

### 3.1 稳定去重指纹 (Fingerprint Generation)

为了确保检测结果在多次扫描中具有稳定的同一性，`Finding.fingerprint` 采用对关键属性进行确定性排序后的 SHA-256 哈希：

指纹输入为仓库或 Worktree 标识、检测器识别的具体问题类型、目标引用、相关来源及规则或场景范围的规范化表示。同一范围内的问题在 OID 或证据更新后沿用原子项。问题类型发生变化时，生成新 Finding 并关联原子项。

`baseCommitOid` 和证据路径用于跟踪检查快照与变化。检测器重新运行后，根据规则实际结果更新 `freshness` 和 `lifecycle`。

### 3.2 任务卡片生命周期状态机

```text
       [检测引擎启动]
             │
             ▼
     ┌───────────────┐   用户从工作台移除   ┌───────────────┐
     │   prepared    │ ─────────────────> │   本次隐藏     │
     └───────┬───────┘                    └───────┬───────┘
             │                                    │
             │ Agent 介入处理 / 执行操作           │ 撤销或检查结果实质变化
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

- **手动移除**。工作台内存记录被隐藏的子项及其证据快照，10 秒内可撤销此次移除。定时重查得到相同结果时维持隐藏，检查结论或相关证据变化时重新展示。检查时间单独更新。离开工作台后丢弃隐藏记录，Finding 按正常缓存周期处理。
- **自动关闭**：重查确认问题已解决时，将子项移出待办并保留本地历史。没有待办子项的卡片从看板收起。

---

## 4. 确定性检测引擎 (Deterministic Detectors)

为了防止卡顿，检测引擎采用**分层调度（2-Tier Scan Pipeline）**：

```text
[ 进入工作台 ]
      │
      ├──> L1: 毫秒级轻量巡检 (Fast Pass)
      │      - 读取已缓存的检查结果与引用快照
      │      - 展示最近一次结果与新鲜度
      │      - 先装载看板骨架
      │
      ├──> 可见时定时刷新
      │      - 刷新相关远端状态，检查引用、祖先和工作树
      │      - 更新结果与检查时间
      │
      └──> 按需核查
             - 用户主动查看证据或准备执行写入时触发
             - 按对应规则获取所需证据，支持超时与取消
```

- **调度**：打开工作台或重新可见时，立即检查缺少结果或结果已过期的项目。工作台可见期间默认每 5 分钟刷新，隐藏时暂停定时触发。合并同一仓库和上游的并发刷新请求，多 Worktree 共享远端刷新，各自检查工作树。限制跨仓库并发，网络失败时退避。
- **Local**：针对检查使用的上游远端 fetch，范围限定为所需的远端跟踪引用和提交对象。调用既有同步接口时须显式指定 `remote` 与 `all: false`，接口默认会 fetch 所有远端。限制分支范围时扩展现有驱动的 fetch 参数。定时刷新只更新跟踪引用和对象，本地分支与工作树由独立的写入流程处理。
- **Edge**：P0 使用可用的只读远端探测校验上游 OID，并使用本地已有对象判断祖先关系。无法探测、刷新失败或缺少祖先证据时，保留上次检查时间并标记「待核查」。完整 Edge fetch 延后。
- **写入前复核**：定时结果用于看板。清单前和实际写入前仍按 §6.2 重新检查，工作台可见性和定时器状态与复核无关。

### 4.1 默认分支快进同步判定 (`DefaultBranchSyncDetector`)

- **安全判定前置条件（全部满足方可标为 safe）**：
  1. 远程分支存在且为本地分支直接后继：$\text{merge-base}(\text{local}, \text{remote}) == \text{local OID}$；
  2. 本地工作树与暂存区完全干净（无未跟踪与未提交修改）；
  3. 该分支未被本地其他活动 Git Worktree 检出占用；
- **异常状态分支分流**：
  - 本地领先或双方分叉 $\rightarrow$ `state: 'bad'` (分叉需人工介入)；
  - 工作树脏污 $\rightarrow$ `state: 'warn'` (存在未提交修改)；
  - 检出锁定 $\rightarrow$ `state: 'warn'` (其他 Worktree 正在使用)。

### 4.2 跨分支集成结果核对（P0 后）

以开发分支 A、B、测试分支 C 和预发分支 D 的固定提交 OID 为检查输入。

1. **内容检查**：在 A、B 的相关变更范围内对比 C、D 的实际结果，记录一致、缺失和差异。单独记录 D 自有基线和范围外变更。D 尚未集成时标记为「待集成」。
2. **冲突证据**：有可比片段时，记录 C、D 两侧的提交、文件路径和结果内容，供用户并排比较。证据缺失时标记为「待核查」。
3. **历史定位**：从可定位的提交进入 `/git`，使用 SOLO 模式查看原来的合并节点。C 的合并顺序作为历史证据。

### 4.3 并行开发与 Worktree 巡检 (`WorktreeParallelDetector`)

- **扫描对象**：遍历各项目已接入的 Git Worktree 列表及本地未合入的活动特性分支；
- **核心判定指标**：
  1. 当前工作树是否存在未提交/未暂存修改（脏工作区预警）；
  2. 特性分支相对于目标默认分支的 Ahead / Behind 提交数；
  3. 分支最后一次提交时间距今是否超过长生命周期阈值（默认 14 天未活动标示为停滞）。

### 4.4 研发流程与发布分支审查 (`BranchWorkflowStandardDetector`)

**延期。** 以下证据规则保留供后续评估。本期的检测器、看板卡片、Portable Check 检查类型和验收范围均排除此项。未来若实现，用户可按需核对 `test` 或 `release/*` 上的变更来源，结果作为人工核查提示。

1. **固定比较范围**。记录受控分支的比较起点、检查时的 HEAD，以及团队认可的来源分支及其快照 OID。沿受控分支的 First-Parent 找出该区间的合入节点与单父提交。
2. **先查看提交关系**。候选提交若可从认可来源的快照到达，可展示「来源快照包含相同提交」。合并节点可展示第一父提交和侧父提交，方便查看这次合入的内容。如果开发分支曾反向同步 `test`，其当前快照也可能包含先进入 `test` 的提交。当前快照只能证明提交可达，判断当时的来源需要合入时的来源快照或对应的 MR 记录。
3. **按需补查 Patch**。候选提交的 OID 未匹配时，可用单父提交的 `git patch-id --stable` 搜索可能的 cherry-pick 或 rebase 对应项，将结果标为「找到相似补丁」。Squash、冲突后改写、历史不完整等情况交由用户查看。
4. **输出可核对的证据**。记录检查区间、候选 Commit OID、来源快照、已匹配的 Commit OID、变更文件及判定理由。证据完整却未找到匹配时显示「所选来源中未找到匹配」。缺基准、缺对象或结果无法比较时显示「待核查」。是否经过 MR 审批需要平台记录。

### 4.5 聚类归卡算法 (`clusterFindingsToCards`)

检测输出的散列 `Finding[]` 数组通过以下规则确定性聚类为 `WorkCard[]`：

```typescript
export function clusterFindingsToCards(findings: Finding[]): WorkCard[] {
  // 1. 按 groupKey 分组聚类
  // - 默认分支同步: groupKey = 'sync:default-branches'
  // - 并行 Worktree: groupKey = 'worktree:parallel-dev'
  // - Integration comparison: groupKey = `merge:scenario:${scenarioId}`
  // 2. 针对每个分组生成 WorkCard 与 WorkItem 列表
  // 3. 统计影响范围 (如 "5 个项目"、"3 个项目 · 4 Worktrees")
  // 4. Apply in-memory dismissals for unchanged findings.
}
```

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

| 证据类型        | P0 跳转约定                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| **Commit 节点** | `/git/<repo-slug>/commit/<oid>`                                                        |
| **文件差异**    | 在提交路由上加 `?file=<path>` 并沿用该提交现有的 Diff 基准。缺少可定位提交时展示路径。 |

证据链接使用正常的浏览器历史导航，返回时根据原子项 URL 恢复选择。自定义两端提交的 Diff 和三方冲突深链保留到 P0 之后。实际冲突由用户发起合并的工具处理。

---

## 6. Agent 药丸联动与操作守卫架构

### 6.1 上下文注入协议 (`WorkdeskContextPayload`)

任务详情展开 Agent 侧栏时，前端在本地载入结构化上下文：

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

用户主动发起请求时，Agent Runtime 取本次所需的上下文字段构建请求。首次使用时说明可能发送哪些数据，以及请求由用户配置的第三方 OpenAPI 提供方处理。

### 6.2 写操作执行守卫

Agent 准备方案，本地执行端负责校验和写入。

1. **清单前重查**：读取当前仓库、目标分支和上游引用，检查相关工作树及进行中的 Git 操作，再跑原检测规则。已解决项移出待办，状态无法确认的项目保留为「待核查」。
2. **用户批准**：展示逐项操作、目标工作树、引用与预期新旧 OID。批准绑定到这份具体清单。
3. **批准后重查并执行**：本地执行端在每项写入前再次校验相同条件。实际操作必须约束到已批准的引用和 OID，并在更新时验证预期旧值。执行端须尊重 Git 的并发锁及进行中的操作。一次批量批准覆盖仍满足批准条件的项目。
4. **竞争后重新分类**：发现并发变更或遇到并发执行失败时，对该项自动刷新并重跑原检查一次。刷新可包含已允许的远端探测或 fetch。更新本地分支或工作树需要对应写入项的批准。

| 重查结果                 | 待办与执行行为                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| 问题已解决               | 标记 `resolved`，移出待办。卡片无待办时收起。                          |
| 同一问题，批准条件仍成立 | 继续已批准的操作。仅在执行条件可验证且仓库没有进行中的冲突操作时重试。 |
| 同一问题，批准条件变化   | 更新原子项和证据。仍需写入时，按最新目标生成方案并等待重新批准。       |
| 问题性质变化             | 关闭原子项并关联新 Finding，例如从可快进变成分叉。新操作单独批准。     |
| 刷新失败或仍存在竞争     | 暂停该项并标记「待核查」，保留最新已知证据。                           |

批次继续处理其他项目。执行后按实际重检结果回写子项和卡片，包含成功、跳过和待核查状态。

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

配方使用 SHA-256 计算正规化远端身份的摘要。基础版复用 `lib/git/project-access.ts` 中 `remoteIdentity()` 的域名和完整仓库路径规则。`checks[].repoIdentityDigest` 引用 `repositories[].identityDigest`。真实仓库名和别名从接收方自己的本地项目读取。

- 导入和执行前均从所选仓库的实际配置读取远端，并在本地重算摘要。唯一匹配时自动绑定，多个匹配时在通过校验的 clone 或 Worktree 中选择。仓库刚添加时重新匹配，指纹不符或没有可验证远端时保留待关联。
- 当前归一化使用 hostname。若非默认端口等信息会在归一化时被丢弃并导致实例无法区分，基础版将该远端标记为无法验证。迁移、改名或路径重用的身份确认留待后续采用提供方的实例与仓库 ID。
- 摘要可以减少明文元数据；知道候选仓库地址的人可以重算并比对。分支名仍会随配方发送。导入端应校验版本、检查类型、规则参数及摘要引用，并在用户确认后运行本地检查。
- 发送方逐项基准与原结论属于后续配方版本。

---

## 8. 本地存储管理与设置中心联动

遵循 Yggit 全局存储管理架构（`app/api/storage` 与 `/settings/general`）：

1. **本地存储路径**：
   - LOCAL 模式下，扫描得到的 Findings 快照保存在 `<APP_ROOT>/data/git-workdesk/` 目录下。手动移除的记录只保存在当前工作台内存；
   - EDGE 模式下，持久化保存在浏览器 IndexedDB 的 `yggit_workdesk_store` 表中。
2. **容量巡检与分类展示**：
   - `/api/storage` 路由自动统计 `git-workdesk` 目录体积，并作为分类项目呈现于 `/settings/general` 的存储分类列表中；
3. **安全清理支持**：
   - 用户在通用设置中点击“清理全部”或单项清理 `git-workdesk` 时，安全清空历史检测快照与过期 Findings，下次打开工作台时重新发起轻量扫描，不影响任何 Git 仓库自身的实际数据。

---

## 9. 实施里程碑与验证计划

- **Milestone 1 (Domain & Storage)**：落地 `lib/workdesk/types.ts` 与双模存储适配器；
- **Milestone 2 (Detectors & Pipeline)**：实现默认分支快进与工作区健康检测器，接入本地 Git CLI 驱动；
- **Milestone 3 (UI Board & Detail View)**：实现自适应四列看板、左右分栏详情页与深链定位；
- **Milestone 4 (Agent Pill & Portable Check)**：打通 Agent 上下文联动与 URL 配方导入导出。
