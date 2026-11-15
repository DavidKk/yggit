# Yggit Agent — 上下文脱敏引擎与双向可逆还原技术设计

> 版本：V1.0  
> 状态：方案设计完成，待编码实施  
> 核心模块：`lib/agent/redact/*`, `lib/agent/openapi-client.ts`, `components/git/agent/settings/PrivacySettingsSection.tsx`  
> 架构归属：Yggit Agent 体系 — 子需求三（上下文脱敏技术架构）  
> 参考机制：[yetone/magpie](https://github.com/yetone/magpie) 本地双向替换设计

---

## 1. 架构目标与总体数据拓扑

本子需求为 Yggit Agent 构建纯客户端的 **上下文数据脱敏与双向可逆还原引擎 (Redaction & Unmasking Engine)**。

系统作为请求拦截器（Request Interceptor）与响应拦截器（Response Interceptor）无缝挂载在 `openapi-client.ts` 通信链路中：

- 在请求发出前，将 Diff、Commit 和提问中的机密/PII/内网信息在浏览器本地替换为**结构化占位符**；
- 在模型流式返回（Streaming SSE）或直接响应时，根据当前会话的内存映射表，**将占位符逆向还原为真实数据**呈现给用户。

### 1.1 双向拦截数据流架构图

```mermaid
flowchart TD
    subgraph UI ["用户交互表现层"]
        UserInput["用户提问输入框"]
        GitContext["Git 上下文 (Commit / Diff / Files)"]
        ChatStreamView["对话输出与卡片视图<br/>(呈现已还原的真实无损文本)"]
    end

    subgraph RedactPipeline ["本地脱敏引擎 (lib/agent/redact)"]
        ScanEngine["正则与熵值规则扫描器 (rules.ts)<br/>Secrets | PII | Network | CustomWords"]
        PlaceholderGen["语义占位符生成器<br/>{{API_KEY_1}} | {{EMAIL_1}} | {{IP_1}}"]
        SessionStore["会话临时映射表 (RedactionSession)<br/>Map<Placeholder, OriginalValue> (纯内存)"]
        UnmaskEngine["反向还原引擎 (unmask.ts)<br/>流式分块缓冲 (Stream Buffer) + 逆向替换"]
    end

    subgraph Transport ["远程通信链路"]
        OpenApiClient["原生 fetch 客户端 (openapi-client.ts)"]
        ExternalLLM["远程模型网关 (如 Vercel AI Gateway Beam 1.0)"]
    end

    UserInput & GitContext --> ScanEngine
    ScanEngine --> PlaceholderGen
    PlaceholderGen -->|建立映射| SessionStore
    PlaceholderGen -->|安全脱敏 Payload| OpenApiClient
    OpenApiClient -->|POST /chat/completions| ExternalLLM
    ExternalLLM -->|返回携带占位符的流式响应| UnmaskEngine
    SessionStore -.->|读取映射| UnmaskEngine
    UnmaskEngine --> ChatStreamView
```

---

## 2. 核心数据结构与契约定义 (`lib/agent/redact/types.ts`)

```typescript
export type RedactionCategory = 'secrets' | 'pii' | 'network' | 'custom'

export interface RedactionRule {
  id: string
  name: string
  category: RedactionCategory
  pattern: RegExp
  placeholderPrefix: string // e.g. "API_KEY", "EMAIL", "IP_ADDR"
  enabled: boolean
}

export interface RedactionOptions {
  enabled: boolean
  categories: {
    secrets: boolean
    pii: boolean
    network: boolean
    custom: boolean
  }
  customWords: Array<{
    word: string
    caseSensitive?: boolean
    wholeWord?: boolean
  }>
  allowList: string[] // 豁免白名单
}

export interface RedactionResult {
  sanitizedText: string
  replacementsCount: number
}

/** 单次会话生命周期内的脱敏映射状态 */
export interface RedactionSession {
  sessionId: string
  placeholderToOriginal: Map<string, string>
  originalToPlaceholder: Map<string, string>
  counters: Record<string, number>
}
```

---

## 3. 预置脱敏规则库与正则设计 (`lib/agent/redact/rules.ts`)

```typescript
export const BUILTIN_REDACTION_RULES: RedactionRule[] = [
  // 1. 机密与令牌 (Secrets)
  {
    id: 'openai-key',
    name: 'OpenAI API Key',
    category: 'secrets',
    pattern: /sk-[a-zA-Z0-9_-]{20,}/g,
    placeholderPrefix: 'OPENAI_KEY',
    enabled: true,
  },
  {
    id: 'github-token',
    name: 'GitHub Token',
    category: 'secrets',
    pattern: /(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,}/g,
    placeholderPrefix: 'GH_TOKEN',
    enabled: true,
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    category: 'secrets',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholderPrefix: 'AWS_KEY',
    enabled: true,
  },
  {
    id: 'private-key',
    name: 'Private Key Block',
    category: 'secrets',
    pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    placeholderPrefix: 'PRIVATE_KEY',
    enabled: true,
  },
  {
    id: 'db-connection-string',
    name: 'Database Connection URI',
    category: 'secrets',
    pattern: /(?:postgres|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s:@/]+@[^\s/]+/gi,
    placeholderPrefix: 'DB_URI',
    enabled: true,
  },

  // 2. 个人身份信息 (PII)
  {
    id: 'email-address',
    name: 'Email Address',
    category: 'pii',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    placeholderPrefix: 'USER_EMAIL',
    enabled: true,
  },

  // 3. 内部网络拓扑 (Network)
  {
    id: 'ipv4-private',
    name: 'Private IPv4 Address',
    category: 'network',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    placeholderPrefix: 'INTERNAL_IP',
    enabled: true,
  },
  {
    id: 'internal-domain',
    name: 'Internal Domain Names',
    category: 'network',
    pattern: /\b[a-zA-Z0-9-]+\.(?:corp|internal|local|lan)\b/g,
    placeholderPrefix: 'INTERNAL_DOMAIN',
    enabled: true,
  },
]
```

---

## 4. 脱敏与流式还原引擎实现

### 4.1 正向脱敏替换实现 (`lib/agent/redact/engine.ts`)

```typescript
export class RedactionEngine {
  private session: RedactionSession
  private options: RedactionOptions

  constructor(options: RedactionOptions, session?: RedactionSession) {
    this.options = options
    this.session = session || {
      sessionId: Math.random().toString(36).slice(2),
      placeholderToOriginal: new Map(),
      originalToPlaceholder: new Map(),
      counters: {},
    }
  }

  public mask(text: string): string {
    if (!this.options.enabled || !text) return text
    let result = text

    // 1. 扫描预置规则
    for (const rule of BUILTIN_REDACTION_RULES) {
      if (!rule.enabled || !this.options.categories[rule.category]) continue
      result = result.replace(rule.pattern, (match) => {
        if (this.options.allowList.includes(match)) return match
        return this.getOrCreatePlaceholder(rule.placeholderPrefix, match)
      })
    }

    // 2. 扫描自定义词典
    if (this.options.categories.custom && this.options.customWords.length > 0) {
      for (const item of this.options.customWords) {
        if (!item.word.trim()) continue
        const escaped = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const flag = item.caseSensitive ? 'g' : 'gi'
        const regex = item.wholeWord ? new RegExp(`\\b${escaped}\\b`, flag) : new RegExp(escaped, flag)

        result = result.replace(regex, (match) => {
          return this.getOrCreatePlaceholder('CUSTOM_TERM', match)
        })
      }
    }

    return result
  }

  private getOrCreatePlaceholder(prefix: string, original: string): string {
    if (this.session.originalToPlaceholder.has(original)) {
      return this.session.originalToPlaceholder.get(original)!
    }

    const currentCount = (this.session.counters[prefix] || 0) + 1
    this.session.counters[prefix] = currentCount
    const placeholder = `{{${prefix}_${currentCount}}}`

    this.session.placeholderToOriginal.set(placeholder, original)
    this.session.originalToPlaceholder.set(original, placeholder)
    return placeholder
  }

  public getSession(): RedactionSession {
    return this.session
  }
}
```

### 4.2 流式分块边界还原处理 (Streaming Chunk Boundary Unmasker)

在 Server-Sent Events (SSE) 流式传输中，占位符（如 `{{USER_EMAIL_1}}`）可能被网络切片截断在两个 chunk 之间（例如 chunk 1 收到 `...用户邮箱是 {{USER_`，chunk 2 收到 `EMAIL_1}}...`）。

系统通过 `StreamingUnmasker` 的滑动缓冲区（Sliding Window Buffer）彻底解决截断问题：

```typescript
export class StreamingUnmasker {
  private buffer = ''
  private session: RedactionSession

  constructor(session: RedactionSession) {
    this.session = session
  }

  /** 接收新的流式分块，返回已安全还原的输出文本 */
  public feed(chunk: string): string {
    this.buffer += chunk
    const lastOpenBrace = this.buffer.lastIndexOf('{{')
    const lastCloseBrace = this.buffer.lastIndexOf('}}')

    // 若末尾存在可能未闭合的占位符片段，保留在缓冲区内暂不输出
    if (lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace) {
      const safePart = this.buffer.slice(0, lastOpenBrace)
      this.buffer = this.buffer.slice(lastOpenBrace)
      return this.unmaskAll(safePart)
    }

    const output = this.buffer
    this.buffer = ''
    return this.unmaskAll(output)
  }

  /** 流结束时的清空吐出 */
  public flush(): string {
    const finalChunk = this.buffer
    this.buffer = ''
    return this.unmaskAll(finalChunk)
  }

  private unmaskAll(text: string): string {
    let result = text
    this.session.placeholderToOriginal.forEach((original, placeholder) => {
      result = result.replaceAll(placeholder, original)
    })
    return result
  }
}
```

---

## 5. 通信拦截器集成 (`lib/agent/openapi-client.ts`)

脱敏层作为纯透明的中间件拦截注入：

```typescript
export async function sendAgentCompletion(
  config: EphemeralAgentConfig,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  tools: AgentToolDefinition[],
  redactionOptions: RedactionOptions,
  signal?: AbortSignal
): Promise<AgentCompletionResponse> {
  const engine = new RedactionEngine(redactionOptions)

  // 1. 请求拦截：脱敏所有发送消息（包含 Git diff 与用户 prompt）
  const sanitizedMessages = messages.map((m) => ({
    role: m.role,
    content: engine.mask(m.content),
  }))

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: sanitizedMessages,
      tools: tools.map((t) => ({ type: 'function', function: t })),
    }),
    signal,
  })

  const rawJson = await response.json()
  const session = engine.getSession()

  // 2. 响应拦截：还原返回结果文本及工具调用参数
  return unmaskCompletionResponse(rawJson, session)
}
```

---

## 6. 设置中心集成 (`SettingsSideNav` ➔ 🛡️ 隐私与合规)

在 `components/git/agent/settings/` 中增加独立的隐私控制区：

```text
╭─────────────────────────────────────────────────────────────────────────────╮
│ 🛡️ 数据脱敏与合规配置                                                       │
│ 保护您的代码资产与隐私，所有敏感数据均在离开浏览器前完成本地替换。            │
│                                                                             │
│ [X] 启用上下文脱敏拦截器 (推荐开启)                                         │
│                                                                             │
│ 脱敏分类：                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] 核心密钥与证书 (API Key、Token、私钥、数据库密码)                   │ │
│ │ [✓] 提交者个人隐私 (Git Author 邮箱、电话)                              │ │
│ │ [✓] 内部网络拓扑 (私网 IPv4、内网 .corp/.internal 域名)                  │ │
│ │ [✓] 自定义敏感词字典                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ 自定义敏感词列表 (Custom Redaction Words)                                    │
│ [ project-titanium × ] [ client-acme × ] [ + 添加新敏感词 ]                 │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│ 🧪 实时脱敏沙箱预览 (Live Redaction Sandbox)                                │
│ 输入测试代码：                                                              │
│ const url = "postgres://admin:secret123@10.0.1.20:5432/orders"              │
│                                                                             │
│ 脱敏后实际发出：                                                            │
│ const url = "{{DB_URI_1}}"                                                  │
╰─────────────────────────────────────────────────────────────────────────────╯
```

---

## 7. 实施计划 (Implementation Roadmap)

| 阶段        | 实施任务                   | 交付物                                                     |
| ----------- | -------------------------- | ---------------------------------------------------------- |
| **Phase 1** | 核心正则与双向脱敏引擎     | `lib/agent/redact/rules.ts`, `engine.ts`, `unmask.ts`      |
| **Phase 2** | 通信中间件与流式缓冲集成   | `openapi-client.ts` 请求与响应拦截器、`StreamingUnmasker`  |
| **Phase 3** | 设置中心 🛡️ 隐私与合规面板 | `components/git/agent/settings/PrivacySettingsSection.tsx` |
| **Phase 4** | 实时沙箱预览与单元测试     | 针对常见机密/PII/内网 IP 的 100% 覆盖单元测试套件          |
