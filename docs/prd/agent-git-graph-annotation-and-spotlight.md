# Yggit Agent — Git 问题定位与标记系统 PRD

> 版本：V1.0  
> 类型：产品需求文档（PRD）  
> 状态：方案已对齐，待研发实施  
> 所属模块：Agent / Git Graph / 节点标记 (Annotation) / 多结果导航 / 证据链与代码影响  
> 架构归属：Yggit Agent 体系 — 子需求二（图谱定位与标记工具）

---

## 1. 需求背景与核心价值

在代码审查（Code Review）、异常合并排查、故障归因与发版核对过程中，单纯依赖 Agent 输出自然语言文本存在严重的协作断层：
* **用户负担沉重**：Agent 找到了相关 Commit，用户仍需手动复制 Hash、在几百条提交中人肉检索、翻找变更文件并人工肉眼比对；
* **复杂拓扑难以辨识**：面对多分支交织、误合入测试分支、Cherry-pick 重复提交等场景，纯文本描述苍白无力，无法直观还原演变脉络；
* **证据可信度缺乏分级**：用户无法分辨哪些是 Git 原生确凿证据（Fact），哪些是模型猜测（Hypothesis）。

因此，本子需求专门为 Agent 打造一套**“图谱定位、多节点高亮、节点插标、多结果导航与代码影响证据链”**的标记工具系统（Agent Graph Spotlight & Annotation System）。

**核心铁律：Agent 负责发现线索并提出解释，Git 原生数据负责提供确凿证据，用户负责最终复核与业务判断。**

---

## 2. 需求目标与非目标

### 2.1 核心目标
1. **精确定位与视口居中**：支持 Agent 指定任意 Commit SHA，工作区自动检索、视口平滑滚动并居中高亮；
2. **多节点分级高亮**：区分主要目标（Primary Target）、关联提交（Secondary/Related）与候选节点，层次分明；
3. **无关节点弱化 (Dimming)**：非目标节点与连线统一压暗至 35% 不透明度，瞬间滤除视觉噪声；
4. **Agent 节点插标 (Graph Annotation)**：在图谱节点旁展示状态徽标（警告、风险、信息、重点），点击唤起 Popover 证据卡片；
5. **多结果步进导航 (Spotlight Stepper)**：返回多个候选 Commit 时，提供浮动步进器（`‹ 2 / 5 ›`），支持键盘与点击逐个巡检；
6. **三级证据链体系**：严格区分 Git 确凿事实（Fact）、确定性推导（Derived）与模型推测（Hypothesis）；
7. **零存储与非破坏性**：所有高亮与标记纯内存持有，不修改任何 Git 仓库数据、历史或 Refs。

### 2.2 非目标
* 不包含 Agent 自动执行 Merge、Rebase、Reset、Revert 等写入性 Git 命令；
* 不包含将模型推测自动判定为“人工 CR 通过”；
* 不在 Focus/Dim 模式下物理删除 Git 节点或重连拓扑虚假边，坚守 DAG 真实拓扑语义。

---

## 3. 业务场景全景矩阵

| 场景编号 | 场景分类 | 典型用户提问 | Agent 交付的核心标记与定位行为 |
|---|---|---|---|
| **S-01** | **分支污染排查** | “feat/order 是否误合入了 test 分支？” | 定位合入 Merge 点为主要目标，将 test 来源提交集合标记为风险关联，图谱全链路高亮，其余分支弱化。 |
| **S-02** | **发布变更审计** | “找出上周所有合入 release 的 Merge。” | 批量标记 Merge Commit 集合，启动多结果导航器（`‹ 1 / 8 ›`），支持一键逐个跳转。 |
| **S-03** | **提交作者溯源** | “这个 Commit 是谁提交的？改了什么？” | 快速定位该 Commit，右侧高亮对应变更文件及代码行范围，展示作者与提交时间。 |
| **S-04** | **故障归因排查** | “昨天订单接口报错，帮我找出最近修改订单的提交。” | 结合文件路径与时间窗口筛查候选提交，按怀疑度降序打标并提供静态 Diff 依据。 |
| **S-05** | **CR 重点建议** | “最近十个提交里哪些值得重点 Review？” | 筛选出包含敏感配置、大量核心逻辑修改的节点并插上关注徽标，提供潜在影响分析。 |
| **S-06** | **逻辑关系联结** | “这个 Bug 是哪个提交修复的？有 Revert 吗？” | 建立问题引入 ➔ 修复提交，或原始提交 ➔ Revert 提交的非拓扑关联标记。 |

---

## 4. 核心功能规范 (F01 ~ F10)

### F01 — Commit 精确定位 (P0)
* Agent 输出目标 Commit Hash 后，驱动工作区：
  1. 若该 Commit 位于虚拟滑动窗口之外，调用两级索引（Skeleton Index）换算虚拟偏移量，平滑滚动至视口可见中央；
  2. 目标节点附加发光呼吸轮廓（`ring-2 ring-accent scale-110 shadow-[0_0_8px_var(--accent)]`）；
  3. **防夺焦机制**：初始定位仅执行一次；一旦用户主动滚动鼠标或点击其他节点，立即释放视口控制权，绝不反复抢焦。

### F02 — 多 Commit 分级高亮 (P0)
* 支持单次请求标记多个节点，并以视觉层级区分角色：
  - **Primary（主要目标）**：醒目重高亮（强调色光晕 + 边框强化）；
  - **Related / Lineage（关联/上下游）**：连线加粗至 3.5px，节点常态点亮；
  - **Candidate（筛查候选）**：黄色/紫色风险标记轮廓。

### F03 — 无关节点弱化 (Dimming) 与折叠 (P0/P1)
* **Dim 模式 (P0 默认)**：
  - 非目标链路的节点及连线整体降至 `opacity-35`（连线 `opacity: 0.25`）；
  - 保留完整 DAG 拓扑连线，禁止篡改父子引用关系；
* **Focus 模式 (P1)**：折叠连续的无关节点区间为汇总占位符（`[… 12 个无关提交 …]`），支持点击展开。

### F04 — Agent 节点标记 (Annotation Badge) (P0)
* 在 GitGraph 提交行中的 RefCell 旁预留插标槽，展示轻量徽标：
  - ⚠️ **Risk**（风险：如误合入测试分支、大面积破坏性变更）；
  - 🔍 **Audit**（重点审查：涉及鉴权、加密、核心支付逻辑）；
  - ℹ️ **Info**（信息：如 Revert 节点、版本发布节点）。
* 单个 Commit 允许多个标记聚合（显示数字 Badge 如 `+2`）。

### F05 — 标记详情与证据分级 (P1)
* 点击标记徽标弹出详情面板，展示：
  - 标记原因与简短摘要；
  - 涉及的具体文件列表与修改行号；
  - **三级证据严格标识**：
    - 🟩 **Fact (确凿事实)**：由 Git Diff 或 Merge 拓扑直接证明；
    - 🟨 **Derived (确定性推导)**：基于代码静态结构或确定性规则计算得出；
    - 🟦 **Hypothesis (模型推测)**：基于上下文意图推测，必须加注“需人工核实”。
  - 提供人工确认入口：`[ ✓ 确认问题 ]` `[ ✕ 驳回标记 ]`。

### F06 — 多结果步进导航器 (Spotlight Stepper) (P0)
* 当一次分析返回多个 Commit 时，底部药丸或右上角浮现微型导航栏：
  - 控件布局：`[ ‹ 上一个 ]` `[ 2 / 5 ]` `[ 下一个 › ]` `[ ✕ 清除高亮 ]`；
  - 支持键盘快捷键：`← / →` 或 `p / n` 键切换；
  - 点击“清除高亮”立即复原全部分支不透明度，无痕退出高亮模式。

### F07 — 节点间逻辑关系联结 (P1)
* 为非直接父子的 Commit 建立语义关联（如 `Bug 引入 ➔ 修复提交` 或 `Original ➔ Revert`）；
* **表现形式**：在详情面板中通过关联标签（Relation Chips）呈现，并在图谱中以虚线或相同色调标识，**严禁使用真实 Git DAG 拓扑实线**，杜绝误解。

### F08 — 非破坏性清除与状态复原 (P0)
* 清除聚焦是一等公民操作，支持：
  - 快捷键 `Esc` 或点击 `✕` 瞬间恢复全部分支完整视野；
  - 清除聚焦仅重置视图临时高亮，**绝不删除 Agent 聊天记录**；
  - 用户可随时从历史对话卡片中点击“重新定位”再次点亮。

### F09 — Agent 与 Git 工作区双向联动 (P1)
* **Agent ➔ Git**：定位节点、高亮链路、插入标记、打开对应 Diff；
* **Git ➔ Agent**：用户在 GitGraph 任意节点右键 `[询问 Agent 此提交]` 或 `[添加到 Agent 上下文]`，将 Commit Hash 注入提问插槽。

### F10 — 只读与安全性绝对边界 (P0)
* 该系统纯属**前端视图渲染与分析辅助**：
  - 严禁触发任何修改本地文件、创建提交或推送远程分支的指令；
  - 凭证与标记数据严格遵循**零存储（Zero-Storage）**纯内存持有。

---

## 5. 数据结构契约与规范

```typescript
export type EvidenceLevel = 'fact' | 'derived' | 'hypothesis'

export type AnnotationType = 'risk' | 'audit' | 'info' | 'relation'

export interface GraphAnnotation {
  id: string
  repoKey: string
  commitHash: string
  type: AnnotationType
  title: string
  summary: string
  evidenceLevel: EvidenceLevel
  evidenceFiles?: Array<{ path: string; lines?: string }>
  status: 'pending' | 'confirmed' | 'dismissed'
  createdAt: number
}

export interface CommitTarget {
  hash: string
  role: 'primary' | 'related' | 'candidate'
  label?: string
}

export interface AnalysisSpotlightResult {
  analysisId: string
  summary: string
  targets: CommitTarget[]
  annotations: GraphAnnotation[]
  relations?: Array<{
    sourceHash: string
    targetHash: string
    type: 'fixes' | 'reverts' | 'cherry-picked' | 'depends-on'
  }>
}
```

---

## 6. 核心验收指标 (Acceptance Criteria)

* **AC-1 精准视口直达**：点击任意定位动作，主视口在 `250ms` 内平滑定位并聚焦目标节点，误差距离为 0；
* **AC-2 弱化对比清晰**：激活 Spotlight 模式后，无关节点与连线透明度统一下调至 35%，目标节点清晰发光凸显；
* **AC-3 导航不夺焦**：初始定位完成后，用户自由滚动鼠标不发生被动回弹；点击 Stepper 切换时精准跳转；
* **AC-4 证据真实透明**：所有标记必须附带证据级别标签，不得将模型推断伪造成已确认事实；
* **AC-5 秒级一键复原**：按下 `Esc` 或点击清除按钮，视图以 `< 16ms` 瞬间重置回 100% 原始全景视图。
