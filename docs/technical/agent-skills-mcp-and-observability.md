# Agent Skills, WebMCP, Token Observability & Service Diagnostics

This document outlines the architecture, data models, and runtime flows for the custom Skill engine, WebMCP & HTTP MCP tool integration, token usage observability, and service diagnostics in Yggdrasil.

## 1. Custom Skill System (Agent Skills Standard)

The Skill system adheres to the open standard defined by [Agent Skills](https://agentskills.io/) using `SKILL.md` as the core format with YAML frontmatter.

### Core Components

- **`lib/skills/types.ts`**: Types for `SkillDescriptor` and `ParsedSkillMd`.
- **`lib/skills/parser.ts`**: Extracts YAML frontmatter (`name`, `description`, metadata) and instructions body from `SKILL.md`.
- **`lib/skills/presets.ts`**: Out-of-the-box built-in skills (`Git Code Review`, `Git Conflict Analysis`, `Conventional Commits Crafting`).
- **`lib/skills/storage.ts`**: IndexedDB storage (`yggit_skills_store`) with preset initialization and live subscriptions.
- **`lib/skills/matcher.ts`**: Matches enabled skills dynamically against user requests and injects task workflows into the system prompt.
- **`lib/skills/providers/github-provider.ts`**: Fetches `SKILL.md` directly from public or private GitHub repositories.

---

## 2. Model Context Protocol (MCP) & WebMCP

Connects external tools and in-page capabilities to the Git Agent following the [Model Context Protocol](https://modelcontextprotocol.io/) specification.

### Core Components

- **`lib/mcp/types.ts`**: Types for `McpServerConfig`, `McpToolInfo`, and `WebMcpSupportReport`.
- **`lib/mcp/client.ts`**: Streamable HTTP client executing standard JSON-RPC 2.0 requests (`initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`).
- **`lib/mcp/webmcp.ts`**: Browser WebMCP (`document.modelContext`) environment probe.
- **`lib/mcp/storage.ts`**: Persistent configuration store for MCP servers in IndexedDB (`yggit_mcp_store`).
- **`lib/agent/tools.ts`**: Dynamic tool binding that maps enabled MCP server tools to `AgentToolDefinition`s (`mcp__{serverId}__{toolName}`) and routes executions seamlessly.

---

## 3. Token Metrics & Observability

Observability subsystem inspired by ticket-janitor, tracking input prompt tokens, output completion tokens, cached context hits, total volume, request counts, and latency.

### Core Components

- **`lib/agent/metrics/types.ts`**: `TokenUsageRecord` and `TokenMetricsSummary`.
- **`lib/agent/metrics/storage.ts`**: IndexedDB store (`yggit_metrics_store`), period aggregations (7d / 30d / 90d), cache hit rate calculations, model breakdowns, and purpose breakdowns.
- **`lib/agent/openapi-client.ts`**: Automatic token recording upon completion of each LLM turn (both streaming SSE and JSON).

---

## 4. Agent Task Tracking & Step Traces

Records the end-to-end execution journey of the Agent when tasked during user conversations.

### Core Components

- **`lib/agent/tasks/types.ts`**: `AgentTask` and `AgentTaskStep` (`skill_match`, `llm_turn`, `tool_call`, `artifact`).
- **`lib/agent/tasks/storage.ts`**: IndexedDB store (`yggit_tasks_store`) tracking task lifecycle (`pending`, `running`, `completed`, `failed`).
- **`lib/agent/agent-context.tsx`**: Automatic task instantiation, skill matching step tracing, tool call logging with arguments/results, and completion summaries.

---

## 5. Service Diagnostics Logs & Issue Reporting

Centralized in-memory ring-buffer and IndexedDB logging across `agent`, `mcp`, `skill`, `git`, and `system` modules.

### Core Components

- **`lib/logger/index.ts`**: `recordLog`, `logInfo`, `logWarn`, `logError`, `loadPersistedLogs`, and `generateIssueReportMarkdown`.
- **`components/git/agent/settings/LogsSettingsSection.tsx`**: Live log viewer, level/module filters, search, and one-click sanitized GitHub/GitLab issue report generator.

---

## 6. UI Settings Routes

Integrated into Yggdrasil's settings layout:

- `/settings/skills`: Custom Skills management.
- `/settings/mcp`: MCP servers & WebMCP status.
- `/settings/tokens`: Token utilization metrics and recent logs.
- `/settings/tasks`: Agent task execution trace viewer.
- `/settings/logs`: Service diagnostics logs and issue export.
