# Yggit — Web/Edge 优先：问题诊断与极速分享 PRD

> 版本：V1.0  
> 类型：产品需求文档（PRD）  
> 状态：方案选定，待研发实施  
> 所属模块：Web/Edge 架构 / 分支拓扑溯源 / 交互式问题分享 / 双模驱动

---

## 1. 需求背景与核心痛点

### 1.1 现状与团队协作真实痛点

在日常研发与 Code Review 过程中，开发者在排查 Bug、追踪代码引入源头、核对分支合并时，面临以下痛点：

1. **“截图沟通”低效且割裂**：
   - 现存沟通方式基本是开发者在本地工具中截一张图发给同事（微信、飞书、Slack、钉钉）。
   - **痛点**：截图是静态死图，接收方无法点击查看上下文、无法展开折叠 Diff、无法追踪前置提交、无法查看相关文件，沟通成本极高。
2. **命令行 CLI 对复杂分支拓扑极不友好（“谁合并了谁”）**：
   - 当在 CLI 里给出一个 Commit Hash（例如 `7f0b0d8`）时，普通开发者通过 `git log --graph` 极难快速辨别该提交是从哪个 Feature 分支合并进来的、包含了哪些前置变更、合并基准（Merge Base）在哪。
3. **传统桌面 GUI 工具安装与共享门槛高**：
   - GitKraken、SourceTree、Fork 等工具需要安装体积庞大的客户端，接收方未安装或版本不一致时无法快速对齐。
4. **与 CHAYA 纯本地工具的本质区别**：
   - CHAYA 主要服务于个人本地开发与重度工作流。
   - **Yggit 的主战场是“发现问题、溯源拓扑、极速分享给别人交互式协同查看”**。

### 1.2 核心目标：告别截图，链接即诊断

实现：**“无需安装、打开即用、链接即可交互、拓扑脉络一眼分明”**。

- **极速打开**：纯 Web 页面部署在 Edge，任何人收到链接，打开浏览器即可秒级加载。
- **动态交互**：接收方打开链接，直接聚焦在出问题的 Commit、Diff 文件与具体代码行，并能自由溯源上下文。
- **分支演变直观透视**：通过有机贝塞尔连线，一眼看清“哪个分支合并到了哪个分支”。
- **双模弹性**：支持开发时切换本地 Local 模式（像 CHAYA 一样调本地 Git CLI 高性能读写），但**100% 优先做好 Web 端的打开即用与极速分享体验**。

---

## 2. 需求范围

### 2.1 P0 核心范围（本期必达）

- **Edge 纯 Web 免安装运行**：
  - 依赖标准 Web API，部署于 Cloudflare Pages / Vercel Edge 等无状态环境。
  - 公开仓库免登录直开，私有仓库凭 Token 或本地目录秒开。
- **精准问题分享体系（替代静态截图）**：
  - 支持分享具体 Commit 及其展开的文件 Diff。
  - 支持代码行号高亮分享（如 `#L18-L45`）。
  - 在剪贴板中生成包含仓库、Commit 说明、精简拓扑与直达链接的“富文本/Markdown 分享卡片”。
- **“谁合并了谁”拓扑脉络强化**：
  - 针对 Merge Commit，在生命图谱与详情面板中清晰标识：
    - 主干分支（Target Branch / First Parent）
    - 合入分支（Source Branch / Second Parent）
    - 合并来源与引入的提交范围（Commits Included）
- **本地目录免重选（IndexedDB 句柄持久化）**：
  - 在 Chromium 浏览器（Chrome / Edge）下，授权本地文件夹后句柄存入 IndexedDB。
  - 刷新网页（F5）或重新打开标签页，**零弹窗自动静默恢复访问**。
- **双模驱动架构预留（Driver Pattern）**：
  - 底层抽象 `IGitDriver`，Web 端优先使用 `isomorphic-git` + Web File System Access API；本地开发保留切换至 Node 本地 Git CLI 的能力。

### 2.2 P1 扩展范围

- **Edge SSR 动态社交分享预览图（OpenGraph Card）**：
  - 当把分享链接发到 Slack / 飞书 / 微信 / Discord 时，服务端自动生成分支拓扑微缩卡片预览。
- **Merge 冲突重现与基准 Diff**：
  - 查看合并提交时，支持一键对比 `Parent 1 vs Merge` 与 `Parent 2 vs Merge` 的三方 Diff。
- **跨平台非 Chromium 浏览器优化**：
  - 为 Safari / Firefox 提供本地 Zip/Patch 拖拽解析降级通道。

---

## 3. 核心功能场景与交互规范

### 3.1 场景一：发现问题，生成交互式分享卡片

1. **定位问题**：
   - 开发者在图谱中定位到引起故障的 Commit `c735e9a`（或某个 Merge Commit）。
   - 在侧边栏文件列表中选中发生变更的文件 `src/billing/service.ts`，并在 Diff 面板选中第 45~58 行。
2. **复制分享**：
   - 点击面板顶部的「分享问题」按钮（快捷键 `Cmd/Ctrl + Shift + C`）。
   - 系统生成精准深链接：
     `/repo/github/my-org/billing/commit/c735e9a?file=src/billing/service.ts#L45-L58`
   - 剪贴板自动复制标准化 Markdown 卡片：
     ```markdown
     🐛 **[Yggit 问题排查]** 发现提交异常引入
     - 仓库：my-org/billing
     - 提交：`c735e9a` (feat: update payment gateway)
     - 合并脉络：feature/stripe-v2 ➔ main
     - 目标文件：`src/billing/service.ts#L45-L58`
     👉 点击在 Yggit 中交互式查看完整拓扑与 Diff: https://yggit.dev/repo/my-org/billing/commit/c735e9a?file=src/billing/service.ts#L45-L58
     ```

### 3.2 场景二：接收方打开链接，即时诊断

1. **免安装秒开**：
   - 接收方无论在手机、平板还是没配 Node 环境的新电脑上，直接点开链接。
2. **状态自动聚焦**：
   - 页面直接打开该仓库，自动定位并高亮 Commit `c735e9a`。
   - 右侧文件面板自动展开并高亮选中的代码行号 `L45-L58`。
3. **上下文回溯**：
   - 接收方不是在看一张死图，而是可以上下滑动查看祖先 Commit、切换分支、查看该功能在整体项目生命树上的分叉点与合入点。

### 3.3 场景三：“谁合并了谁”智能解析面板

在提交详情面板中，对于任意 Merge Commit，新增 **拓扑演变卡片（Topology Breadcrumb）**：
- **来源与流向**：清晰以徽标展示：`[分支 feature/pay-api] ➔ [目标分支 main]`。
- **分支分歧点（Merge Base）**：标出从哪个 Commit 开始分叉，分歧期间共有几条提交。
- **快速高亮两端**：点击「高亮来源分支」，图谱中属于该 Feature 的整条泳道瞬时高亮，其他背景变暗，一目了然看清代码合并轨迹。

### 3.4 场景四：项目迁移 / 路径失效 / 私有未定位时的「统一重新关联与重新授权」机制

在实际开发中，以下四种情况在本质上属于**同一种状态**（本地数据源无法定位）：
1. **首次打开同事分享的私有/内网自建 GitLab 链接**（本地尚未建立对应映射）；
2. **开发者移动了本地文件夹**（例如从 `~/dev/project` 迁移到了 `~/workspace/project`）；
3. **文件夹被重命名或原磁盘句柄失效**；
4. **多分支/多 Worktree 副本切换**（想用另一个本地 Clone 副本打开）。

**产品统一交互规范**：
- **拒绝硬性报错**：系统绝不展示生硬的“404 Not Found”或冷冰冰的错误代码。
- **统一降级为「重新关联 / 重新授权」引导（Re-associate Guide）**：
  - 顶部清晰标识出需要查找的仓库标识（如 `gitlab.mycorp.internal/fe/pay-system`）与目标 Commit。
  - 提供**一键从已有项目列表选择**（下拉点选）或**重新选择本地目录**（File System Access API）。
  - 用户选定新路径后，系统自动修复 IndexedDB 中的映射关系，瞬间无缝进入该 Commit 的审查视图。

---

## 4. 验收标准（Acceptance Criteria）

- **AC-01 (Zero Install Web-First)**：用户访问部署在 Edge 的站点，无需安装任何本地守护进程或桌面客户端，能在 1 秒内完成冷启动。
- **AC-02 (Merge Context Trace)**：对于 Merge Commit，必须以显著视觉元素明确标示“Source Branch”与“Target Branch”，杜绝 CLI 中无法辨别合并方向的问题。
- **AC-03 (Precision Deep Link)**：分享链接包含完整的 Commit SHA、文件路径、代码行号范围；接收方打开后精准定位。
- **AC-04 (Local-Handle Persistence)**：在 Chrome / Edge 中授权本地文件夹后，刷新页面（F5）及关闭标签重开均无需重复调用文件夹选择弹窗。
- **AC-05 (Dual-Mode Compatibility)**：本地开发环境支持通过环境变量或配置切换为 Local CLI 驱动模式，核心视图与逻辑保持 100% 同构。
- **AC-06 (Unified Re-association)**：当项目被移动、路径失效或私有仓库尚未关联时，统一引导至重新关联与重新授权面板，绑定后即刻自动定位。
