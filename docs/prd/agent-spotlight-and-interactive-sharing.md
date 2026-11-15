# Yggit — 居中药丸 Agent 快捷交互与问题标记分享 PRD

> 版本：V1.0  
> 类型：产品需求文档（PRD）  
> 状态：方案已对齐，待研发实施  
> 所属模块：Agent 快捷交互 / 居中药丸入口 (Pill Bar) / 零存储 OpenAPI (Zero-Storage BYOP) / 拓扑标记与高亮联动 / 交互式深链接分享

---

## 1. 需求背景与核心痛点

### 1.1 现状与团队协作痛点

在日常代码协同与 Git 仓库管理中，开发者经常需要快速求证以下高频问题：

1. **“今天合并了哪些分支？”**（如核对今天合入 `TEST` 或 `RELEASE` 的功能清单）；
2. **“某个 Commit 是谁提交的、从哪个分支带进来的？”**（追踪变更源头与责任人）；
3. **“某个 Feature 分支是否被测试分支污染了？”**（上线前紧急核查：某特性分支是否误合入了 `test` / `develop` 分支的代码）。

在现有研发流程中，处理这些问题存在三大痛点：

- **命令行门槛高且割裂**：开发者需要记忆复杂的 Git 命令组合（如 `git log --merges --since=...`、`git merge-base --is-ancestor`），且 CLI 输出的文本难以直观还原分支演变；
- **传统 AI 助手配置重、成本高**：多数 AI 方案强制要求服务端提供商业 API Key，或迫使每个用户购买按量 Token，难以在轻量 Web 环境推广；同时，通用对话机器人的文本输出与 Git 可视化画布完全脱节；
- **排查结果“截图沟通”低效**：排查出分支污染或异常提交后，开发者只能截一张死图发到飞书/微信群，接收方无法点击、无法验证上下文、无法追溯上下游提交。

### 1.2 核心目标：自然语言快速排查，状态高亮一键分享

为 Yggit 构建一个**页面居中的药丸（Pill）形式 Agent 交互入口**，实现：

1. **输入即交互**：用户用一句话自然语言提问，Agent 自动提取意图并查询 Git 仓库状态；
2. **零存储极简直连**：无需服务端辅助，用户通过配置自建代理（如 `vercel-gemini-proxy`、Cloudflare Worker 等），凭证仅保存在浏览器当前运行内存中（**Zero-Storage**），用完即走，绝不落盘；
3. **图谱联动高亮与弱化**：Agent 查出问题后，主视图生命树（GitGraph）自动高亮关键上下游 Commit 链路，并**自动弱化/压暗所有无关分支**；
4. **无状态深链接协同分享**：一键将诊断结论、高亮链路编码为轻量 URL 与 Markdown 问题卡片，接收方点开即直接还原高亮排查视口，告别低效截图。

---

## 2. 核心设计原则

| 维度         | 设计规范                                              | 核心收益                                                                                           |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **入口形态** | **底部居中悬浮药丸 (Bottom Floating Capsule)**        | 极简、不侵占主图谱空间；支持 `Cmd/Ctrl + J` 秒级唤出                                               |
| **存储模型** | **零存储纯内存 (Zero-Storage & In-Memory Only)**      | 凭证仅存于当前 React State，刷新或关闭 Tab 即刻销毁，硬盘零残留，彻底规避泄露风险                  |
| **协议标准** | **轻量 OpenAPI (BYOP / BYOK)**                        | 纯原生 `fetch` 请求 `/v1/chat/completions`，零第三方 SDK 依赖，支持主流兼容代理                    |
| **执行闭环** | **一次往返直接出卡片 (One-shot Execution)**           | 大模型仅负责意图与参数抽取，拿到工具指令后由本地 Git 引擎直接生成富交互卡片，节省 50% 耗时与 Token |
| **图谱联动** | **焦点高亮 + 局部淡化 (Lineage Highlight & Dimming)** | 命中链路发光加粗，其余分支降为 `opacity-35`，问题脉络一秒分明                                      |
| **协同分享** | **无状态深链接 (Stateless Deep Link)**                | 标记状态全部编码在 URL Query 中，不依赖后端数据库持久化，分享秒开                                  |

---

## 3. 典型用户场景与体验流程

### 场景一：上线前分支污染排查与一键协同分享（核心场景）

1. **发起诊断**：
   - 开发者按下 `Cmd/Ctrl + J`（或点击底部药丸）唤出输入框，输入：`feat/cart 是否包含了 test 分支？`
2. **意图解析与诊断**：
   - 浏览器直连用户配置的代理，Agent 返回调用工具 `check_branch_containment(source: "feat/cart", target: "test")`；
   - 本地 Git 引擎计算得出：`feat/cart` 误合入了 `test` 分支，定位到合入节点 `7a88b1` 及前置提交 `c128f9`。
3. **图谱沉浸高亮**：
   - 画布平滑滚动至该合入点，合入链路中的 Commit 发光高亮；
   - 图谱中其余无关分支自动弱化变暗，脉络一眼辨别。
4. **生成分享卡片**：
   - 药丸面板内呈现结构化诊断卡片，附带 **`[ 🔗 复制排查分享卡片 ]`**；
   - 开发者一键复制 Markdown 发至团队群，同事点开链接，浏览器无感进入同一聚焦视口并同步保持高亮。

### 场景二：每日例会与发布排查（“今天合入了哪些分支？”）

1. 开发者在药丸中点击预置快捷气泡 `[ 📅 今日合并到 TEST ]`；
2. Agent 执行 `get_today_merges(target: "TEST")`，输出今日合并的分支名、PR 标题、提交人头像列表；
3. 点击卡片中的任意合并项，生命树图谱瞬间聚焦并选中该 Merge 节点。

### 场景三：提交作者与引入溯源（“某段 Commit 谁提的？”）

1. 开发者在药丸中粘贴短 Hash `f3c2a1` 或提交说明关键字；
2. Agent 查出提交人姓名、邮箱、提交相对时间及变更文件概览；
3. 提供 `[在生命树中定位]` 按钮，点击直接打开对应的 Diff 详情侧边栏。

---

## 4. 功能需求清单 (Scope & Functional Requirements)

### 4.1 P0 核心功能（MVP 必达）

- **F1 居中药丸交互组件 (`GitAgentBar`)**：
  - 常态：页面水平居中悬浮半透明毛玻璃药丸，展示占位文案及快捷键标识 `[ ✦ 问问 Yggit Agent... ⌘K ]`；
  - 展开态：点击或快捷键展开为 Command Palette 浮层，支持对话流输出、ESC 退出、外部点击自动收起；
  - 快捷 Action 气泡：提供今日合并、分支包含、Commit 溯源三个快捷引导按钮。
- **F2 模型通道与独立配置中心 (`AgentConfigModal` & `AgentOpenApiClient`)**：
  - **二级导航双栏布局**：参考 `CHAYA` 与工单系统 (`ticket-janitor`) 规范，配置中心采用 **左侧纯 ICON 垂直子导航 + 右侧左对齐表单区** 架构：
    - 左侧子导航包含三个二级分类：🤖 **模型通道 (`models`)**、🛡️ **隐私与合规 (`privacy`)**、⚙️ **通用偏好 (`general`)**；
    - 右侧内容区严格采用左对齐排布，限制最大表单宽度为 `max-w-2xl`，视觉聚拢舒适。
  - **免费模型数据收集提示 (Data Collection Warning)**：
    - 针对 `Vercel 免费` 或其他第三方免费模型，在表单显要位置固定展示警示卡片：
      > _“⚠️ 数据使用须知：当前免费模型通道为公共赞助服务，不包含零数据留存（Zero Data Retention）保证。您的提问与分析上下文（包括代码/提交片段）可能会被服务提供商用于模型训练或服务改进。若排查涉及企业核心代码或商业机密，建议切换至私有 BYOP 或本地 Ollama 通道。”_
  - **三大通道预设 (Provider Presets)**：
    1. **⚡ Vercel AI Gateway 免费通道 (默认首选)**：预设 Base URL 为 `https://ai-gateway.vercel.sh/v1`（或由本地服务转发防跨域），默认模型 `reflection/beam-free`（0元免费，1M 上下文，支持 Tool Calling）；
    2. **🛠 自定义 OpenAPI / BYOP**：支持用户填写自建 `vercel-gemini-proxy`、Cloudflare Worker 或第三方聚合网关；
    3. **💻 本地 Ollama 通道**：一键预设 `http://localhost:11434/v1`，无需网络，100% 离线私密。
  - **连通性测试与零存储安全**：
    - 提供一键 `[测试连接]` 探测按钮，实时反馈 HTTP 状态码与握手延迟；
    - 明确标识 **Zero-Storage 纯内存安全机制**：密钥仅在当前标签页内存中生效，刷新即清空，绝不落盘；
  - 基于原生 `fetch` 与标准 `/v1/chat/completions` 通信，无需加载重型 npm SDK。
- **F3 核心 Git 诊断工具集 (`services/git/agent-tools`)**：
  - `check_branch_containment(sourceBranch, targetBranch)`：计算分支包含与拓扑偏差点；
  - `get_today_merges(targetBranch)`：获取当天合入目标分支的所有 Merge Commits 与分支来源；
  - `get_commit_details(query)`：模糊搜索或按 Hash 提取 Commit 详情及作者信息。
- **F4 画布联动与局部高亮弱化 (`Lineage Highlight & Dimming`)**：
  - Agent 诊断命中后，自动设置 `lineageHashes`，图谱将目标链路加粗发光；
  - 非目标链路的节点与连线一律降低至 35% 不透明度；
  - 自动平滑滚动并将焦点 Commit 定位至主视口中央。
- **F5 无状态深链接生成与分享 (`Issue Share Card`)**：
  - 将当前诊断的高亮节点列表、聚焦节点、诊断标签序列化为 URL Query 参数（如 `?focus=7a88b1&lineage=c128f9,7a88b1&tag=test-leak`）；
  - 提供富文本与 Markdown 一键复制功能，支持无缝粘贴到协作聊天软件；
  - 接收端打开该链接时，页面路由无损反序列化并自动进入相同的高亮与弱化状态。

### 4.2 P1 扩展功能

- **F6 Local 模式自动桥接本地 CLI 订阅**：
  - 在 `YGGIT_SERVICE=local` 环境下，若本机已安装并登录 `claude-code`、`gemini-cli` 或 `codex`，支持一键免填 Key 桥接本机个人订阅；
- **F7 冲突预警可视化**：
  - 对检测出的分支包含问题，提供 `ahead / behind` 提交数量及潜在冲突文件的快速预检。

---

## 5. UI 与交互详细规范

### 5.1 视觉样式规范

- **药丸常态 (Collapsed)**：
  - 尺寸：高度 `40px`，圆角 `full`，内边距 `px-4`；
  - 背景：`bg-[var(--panel)]/85` 搭配 `backdrop-blur-md`，边框 `border border-border/60`；
  - 阴影：`shadow-sm hover:shadow-md transition-all duration-200`；
  - 位置：位于主视口底部水平居中 (`bottom: 20px`)，`z-index: 40`。全屏浏览 Diff 时具备 `opacity-80` 避让与 Hover 恢复。
- **展开弹层 (Expanded Sheet)**：
  - 最大宽度 `640px`，上下留白居中弹出；
  - 背景：`bg-[var(--panel)]`，边框 `border border-border`，圆角 `rounded-2xl`，深层投影 `shadow-2xl`；
  - 包含三个区域：
    1. **顶部/设置抽屉**：折叠式 Proxy 配置栏（仅在未填或主动点击 ⚙️ 时展开）；
    2. **中间内容区**：对话输出与富交互结果卡片展示区；
    3. **底部输入栏**：自然语言输入框 + 快捷 Action Chips。

### 5.2 状态提示与安全警告

- 当用户填入 Base URL 时，输入框下方常驻提示：
  > _“⚠️ 凭证仅在当前标签页内存中生效，刷新或关闭后立即销毁。请确保填写的代理支持 CORS 跨域（如自建 Vercel / Cloudflare 代理）。”_
