<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — 世界樹架構 AI Git 工作空間" width="840" />

# Yggit (世界樹 Git)

**Your Git history, brought to life.**

視覺化 Git 提交歷史、管理多 Worktree、主動發現倉庫問題，並藉助 AI 理解你的程式碼。專為 AI 程式設計時代打造的開源、本機優先（Local-first）Git 工作空間。

**免安裝 · 免註冊 · 開源免費 · 本機優先**

<p>
  <a href="https://yggit.vercel.app"><strong>線上體驗</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>下載桌面版</strong></a>
</p>

<p>
  <a href="../../README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a> · <a href="./README.zh-TW.md">繁體中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.fr.md">Français</a> · <a href="./README.de.md">Deutsch</a> · <a href="./README.es.md">Español</a> · <a href="./README.pt-BR.md">Português (Brasil)</a> · <a href="./README.ru.md">Русский</a>
</p>

<p>
  <a href="https://github.com/DavidKk/yggit/actions/workflows/ci.yml"><img src="https://github.com/DavidKk/yggit/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.19-brightgreen?style=flat-square&logo=node.js" alt="Node.js >= 22.19" /></a>
</p>

</div>

---

## 為什麼選擇 Yggit？

現代開發越來越多地涉及多倉庫協同、並行分支、獨立 Worktree 以及多個 AI 程式設計 Agent 同時修改程式碼。傳統 Git 用戶端往往只停留在生硬的地鐵路線圖或基礎 Diff 檢視。

Yggit 將**有機世界樹提交圖譜**、**主動式倉庫健康診斷**與**開放的本機優先 AI 助手**融合在同一個工作空間中——支援直接在瀏覽器開啟、作為本機 Server 執行，或打包為獨立桌面用戶端使用。

---

## 核心能力

### Git, brought to life — 世界樹 Git 歷史視覺化

告別冰冷的工業網格，用**有機生命樹 DAG** 呈現程式碼演進脈絡。三次貝茲曲線分支匯合、主幹與側枝粗細分級、零高度縫隙日期分割線，以及語意化節點標識（虛線 Stash 膠囊、HEAD 呼吸光環與合併年輪結），讓複雜分支歷史一目了然。

### Meet Yggi — 內建 AI 倉庫助手

支援可拖曳懸浮藥丸、快速回覆卡片與可調整寬度的側邊欄工作區。隨時詢問分支統計、提交歷史或合併狀態，一鍵生成 Commit 訊息、引用訊息追問，並在圖譜上透過 **Agent Spotlight** 檢視帶有 Fact / Derived / Hypothesis 證據分級的提交標註。

### Stay ahead of Git problems — Workdesk 主動診斷

**工作台（Workdesk）** 持續掃描目前倉庫的分支同步偏差、待推送程式碼審查、分叉偏離、並行 Worktree 冗餘以及分支命名與目錄規範問題，在演變成合併衝突前提前發現並給出可執行建議。

### One workspace, many repositories — 多專案與 Worktree 管理

在多個本機/遠端倉庫間快速切換，並支援高度可客製化的分支右鍵選單：高頻動作置頂、二級子選單分組、危險操作二次確認防誤觸保護，以及基於倉庫執行能力的自適應過濾。

### Your code stays yours — 本機優先與隱私保護

**預設 Local-first**：倉庫索引、快取與加密後的 API 憑證均保存在你的本機裝置中；並內建端側敏感資訊雙向去識別化機制，在向第三方模型發起請求前自動遮蔽金鑰、信箱與自訂敏感詞。

### Bring your own AI — 開放的 AI 模型與工具生態

自由接入你習慣的模型與工作流，不被單一廠商綁定：

- **Browser AI** — Chrome 內建 Gemini Nano。
- **Browser Local AI** — 基於 WebGPU / WASM 的瀏覽器離線開源模型。
- **本機 CLI Agent** — 適配 Claude、Codex、Gemini、Cursor、Antigravity CLI。
- **OpenAI 相容與主流 API** — 支援 DeepSeek、OpenAI、Claude、Ollama 及自訂閘道，支援萬用字元黑白名單過濾。
- **Skills 與 HTTP MCP** — 支援匯入本機或 GitHub 上的 `SKILL.md` 規範，接入外部 Streamable HTTP MCP Server（支援自訂請求標頭與 MCP OAuth 2.0 PKCE 授權）。

---

## 專為 AI 程式設計時代打造

當多個 AI Agent 同時在不同分支與 Worktree 上並行開發時，倉庫狀態極易失控。Yggit 幫你穩住全域：

- **多 Agent 與多 Worktree 視覺化** — 統一追蹤並行工作樹、未合入提交與分支偏離狀態。
- **主動同步與衝突預警** — 提前識別落後/領先提交、待審查變更與三方合併衝突風險。
- **AI 輔助理解 Diff 與脈絡** — 讓 Yggi 梳理改動影響、追蹤合併來源，並在圖譜上直接高亮關鍵提交。
- **10 種語言全球化介面** — 完整支援繁體中文、簡體中文、英語、日語、韓語、法語、德語、西班牙語、巴西葡萄牙語與俄語。

---

## 三種執行形態

Yggit 提供三種執行形態（`YGGIT_SERVICE`），共享同一套工作台體驗：

| 形態               | 方式                                          | 磁碟與 Git 能力                                                                              |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Local**          | 本機 Node.js 服務貼著倉庫目錄執行             | 完整原生 Git CLI、本機磁碟讀寫、加密本機儲存及本機 CLI Agent 適配                            |
| **Desktop App**    | 獨立桌面用戶端打包形態（`YGGIT_SERVICE=app`） | 完整原生 Git CLI、本機磁碟讀寫與桌面宿主整合                                                 |
| **Edge / Browser** | 瀏覽器免安裝形態（`YGGIT_SERVICE=remote`）    | 伺服端無碟——在 Chromium 瀏覽器中透過 File System Access API 與 `isomorphic-git` 讀取本機倉庫 |

---

## 隱私設計原則

- **無需註冊帳號**：開啟即可使用，零遙測、零帳號綁定。
- **資料留在本機**：倉庫資料、分析快取與加密後的 Token 均保存在你自己的裝置上。
- **明確的外部邊界**：僅向你主動設定的第三方大模型或遠端 MCP 位址發起請求，並可選開啟端側可逆去識別化。詳見應用內 `/settings/privacy` 頁面。

---

## 快速上手

需要 **Node.js ≥ 22.19.0** 與 **pnpm**。

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

在瀏覽器中開啟 [http://localhost:3000](http://localhost:3000)（或啟動日誌輸出的區域網路位址）即可開始使用。

<details>
<summary>展開查看完整開發、測試與桌面 App 打包命令</summary>

| 命令                | 用途                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | 啟動本機開發服務（預設監聽區域網路）                                                                     |
| `pnpm dev:lan`      | 顯式以區域網路模式啟動開發服務                                                                           |
| `pnpm dev:loopback` | 僅監聽本機迴環位址（`127.0.0.1`）                                                                        |
| `pnpm build`        | 建置生產產物（`next build --webpack`）                                                                   |
| `pnpm build:app`    | 建置桌面 App standalone 產物並組裝 `.electron-builder/app-root`                                          |
| `pnpm dist:mac`     | 打包 macOS `.app` 與發布 `.zip`（`x64` + `arm64`）                                                       |
| `pnpm dist:win`     | 打包 Windows NSIS 安裝包（`.exe`）                                                                       |
| `pnpm dist:dir`     | 打包免安裝桌面應用目錄（用於本機驗證）                                                                   |
| `pnpm electron`     | 啟動 Electron 桌面殼（連接 Next 開發服務）                                                               |
| `pnpm start`        | 啟動生產服務                                                                                             |
| `pnpm ok`           | 一鍵執行 `fix:imports`、Prettier 格式化、ESLint（`--max-warnings=0`）、型別檢查、Jest 全量測試與生產建置 |
| `pnpm ok:ci`        | CI 校驗流水線（`format:check`、`lint:check`、`typecheck`、Jest 測試、生產建置）                          |

</details>

## 文件索引

- [開發與架構文件索引](../README.md) — 包含 PRD、UX 規範、技術架構與程式碼規範。

## 參與貢獻

歡迎提交 Issue 與 Pull Request！貢獻前請先閱讀 [CONTRIBUTING.md](../../CONTRIBUTING.md)，安全漏洞回報請參考 [SECURITY.md](../../SECURITY.md)。

## 開源授權

Yggit 是基於 [MIT 授權條款](../../LICENSE) 發布的開源專案。
