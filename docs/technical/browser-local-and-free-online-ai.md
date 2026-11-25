# 浏览器本地模型下载与免费在线 AI 技术设计文档

> 状态：设计定稿 / 准备开发（2026-11-26）

## 1. 总体架构

本次能力在现有 Agent Provider 与右上角 `DownloadCenter` 体系内扩展，不新建第二套 Agent 状态机：

```text
ModelChannelEditor / AgentContext
  ├── provider === 'browser-ai'    ──▶ lib/agent/browser-ai.ts (Chrome Prompt API)
  ├── provider === 'browser-local' ──▶ lib/agent/browser-local.ts ──▶ Web Worker (@huggingface/transformers)
  │                                       │                                    │
  │                                       ▼                                    ▼
  │                              browser-downloads.ts                  CacheStorage ('transformers-cache')
  │                              (右上角 DownloadCenter)                + IndexedDB 元数据/清理
  └── provider === 'kilo-free' (可选 Local/服务端转发) ──▶ /api/git/agent/gateway
```

---

## 2. 浏览器本地模型 (`browser-local`) 技术方案

### 2.1 运行时与依赖

- 依赖：`@huggingface/transformers`（锁定稳定版 `^4.3.2`）。
- 加速优先级：优先探测 `navigator.gpu`（WebGPU），不支持时显式提示或由用户选择 WASM 回退。
- 线程隔离：使用独立 Web Worker（`lib/agent/workers/local-llm.worker.ts`），通过 `postMessage` 传递：
  - `load`：拉取并初始化指定 `repository` / `dtype`；
  - `generate`：流式生成（`TextStreamer` 回调增量 delta）；
  - `abort`：中断当前生成或卸载模型（释放显存/内存）。

### 2.2 候选模型清单与配置结构

```ts
export interface LocalBrowserModelSpec {
  id: string
  name: string
  repository: string
  revision: string
  dtype: string | Record<string, string>
  estimatedBytes: number
  recommended?: boolean
  pipelineTask: 'text-generation' | 'qwen35'
}
```

首批验证清单：

1. **`qwen3.5-0.8b-q4`**（默认推荐）：
   - `repository`: `onnx-community/Qwen3.5-0.8B-ONNX-OPT`
   - `dtype`: `{ embed_tokens: 'q4', decoder_model_merged: 'q4', vision_encoder: 'q4' }`（~635 MB）
2. **`lfm2.5-350m-q4`**（超轻量备选）：
   - `repository`: `onnx-community/LFM2.5-350M-ONNX`
   - `dtype`: `'q4'`（~283 MB）

### 2.3 进度聚合与右上角 `DownloadCenter` 联动

- Transformers.js 的 `progress_callback` 会按单个文件触发 `{ status: 'progress' | 'done', file, loaded, total }`。
- `browser-local.ts` 在内存中维护 `Map<string, { loaded: number; total: number }>`，对同一模型的多文件进度求和计算总百分比，实时调用 `upsertBrowserDownload` 更新右上角 [DownloadCenter](file:///Users/davidjones/Develop/ops/apps/yggdrasil/components/downloads/DownloadCenter.tsx)。
- 所有文件下载完成（`100%`）后，将任务阶段切换为 `phase: 'prepare'`（脉冲条）直至模型完成初始化并可执行推理。

### 2.4 当前域缓存管理与清理按钮

- **存储位置**：当前域 `CacheStorage`（Transformers.js 默认缓存名 `transformers-cache`）。
- **状态检测与体积统计**：
  - `inspectLocalModelCache()`：遍历 `caches.open('transformers-cache')` 的 `keys()`，匹配对应 `repository` URL 前缀，统计已缓存文件数与估算字节数（从 `Content-Length` 响应头读取）。
- **清理实现**：
  - `clearLocalModelCache(repository?)`：
    1. 若当前 Worker 正在运行该模型，先发送 `unload` 释放资源；
    2. 删除 `transformers-cache` 中匹配该仓库（或全部本地模型）的 Cache 条目；
    3. 同步更新 UI 状态与已用空间显示，并弹出 i18n 成功通知。
- **UI 位置**：在模型配置页详情表单底部操作栏左侧（或模型状态行旁）放置 **「清理本地模型」** 按钮（带确认或明确提示），点击即可立即释放当前域缓存。

---

## 3. 免费在线模型 (`free-online`) 实测结论与决策

1. **OVHcloud AI Endpoints**：实测返回 `x-ratelimit-limit-year: 2`，匿名每年仅 2 次请求，**不予接入**。
2. **Kilo AI Gateway (`https://ai-gateway.kilo.ai/api/v1`)**：
   - 无 Key 匿名调用可成功（`HTTP 200`），但**未返回 CORS 响应头**，浏览器端直接 `fetch` 会被同源策略拦截；
   - **接入建议**：仅在 Local 模式 / 服务端网关（`/api/git/agent/gateway`）下作为可选免费网关（若用户需要），不作为纯 Edge 浏览器直连渠道，并在 UI 明确说明请求经本地服务端转发。

---

## 4. Next.js 打包与兼容性要点

- 在 `next.config.ts` 中对客户端 Webpack 配置保留对 `@huggingface/transformers` / `onnxruntime-web` 的兼容（避免 Node-only 模块如 `sharp` / `fs` 在客户端 bundle 报错，设置 `resolve.alias` 将 `sharp`、`onnxruntime-node` 设为 `false`）。
- 严格遵守 `AGENTS.md`：单文件不超过 600–800 行、全英文代码注释、UI 文本全部走 i18n、图标仅使用 `react-icons/lu`。
