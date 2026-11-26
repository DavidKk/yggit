<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — 世界樹 Git グラフ & AI リポジトリワークベンチ" width="840" />

# Yggit

**Your Git history, brought to life.**

Git の履歴を可視化し、Worktree を管理し、リポジトリの課題を早期に発見して AI でコードを理解する。AI コーディング時代のために設計されたオープンソースのローカルファースト Git ワークスペースです。

**インストール不要 · サインアップ不要 · オープンソース · ローカルファースト**

<p>
  <a href="https://yggit.vercel.app"><strong>オンラインで試す</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>アプリをダウンロード</strong></a>
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

## なぜ Yggit なのか？

現代のソフトウェア開発では、複数リポジトリの連携、並列ブランチ、独立した Worktree、そして複数の AI コーディングエージェントによる同時編集が日常的になっています。従来の Git クライアントは画一的な路線図風のグラフや単純な Diff 表示にとどまりがちでした。

Yggit は**有機的な世界樹コミットグラフ**、**プロアクティブなリポジトリ診断**、そして**オープンなローカルファースト AI アシスタント**をひとつのワークスペースに統合し、ブラウザ・ローカルサーバー・デスクトップアプリの 3 形態で動作します。

---

## 主な機能

### Git, brought to life — 世界樹 Git グラフ可視化

無機質なグリッドを**有機的な世界樹 DAG** へ。滑らかな 3 次ベジェ曲線によるブランチ合流、幹と枝の階層表現、ゼロギャップの日付区切り線、Stash カプセルや HEAD パルスリングなどのセマンティックなノード表示により、複雑な履歴も直感的に把握できます。

### Meet Yggi — AI リポジトリ・アシスタント

ドラッグ可能なフローティングピル、クイック応答カード、リサイズ可能なドックサイドバーとして常駐。ブランチ統計やマージ履歴の質問、コミットメッセージ生成、引用フォローアップに加え、Fact / Derived / Hypothesis の根拠ランク付き **Agent Spotlight** ハイライトを確認できます。

### Stay ahead of Git problems — Workdesk による予防診断

**Workdesk** がリポジトリを継続的にスキャンし、ブランチ同期のずれ、プッシュ前のレビュー待ち変更、分岐したブランチ、並列 Worktree の整理、命名・構成規約の問題をコンフリクト前に検出します。

### One workspace, many repositories — マルチリポジトリ & Worktree 管理

ローカル・リモートリポジトリをシームレスに切り替え、ブランチ右クリックメニューを自由にカスタマイズできます（ピン留め、カスケードサブメニュー、破壊的操作の 2 段階確認、リポジトリ機能に応じた自動フィルタリング）。

### Your code stays yours — ローカルファースト & プライバシー保護

**Local-first 設計**：リポジトリ索引、キャッシュ、暗号化された API 認証情報はすべてお使いのデバイスに保存されます。外部モデルへ送信する前にトークンやメールアドレスなどを可逆マスクするクライアント側サニタイズ機能も備えています。

### Bring your own AI — オープンな AI モデル & MCP エコシステム

特定のベンダーに縛られず、好みのモデルやツールを接続できます：

- **Browser AI** — Chrome 組み込み Gemini Nano。
- **Browser Local AI** — ブラウザ上で完結する WebGPU / WASM オフラインモデル。
- **ローカル CLI Agent** — Claude、Codex、Gemini、Cursor、Antigravity CLI アダプタ。
- **OpenAI 互換 & クラウド API** — DeepSeek、OpenAI、Claude、Ollama、カスタムゲートウェイ（ワイルドカード許可/拒否リスト対応）。
- **Skills & HTTP MCP** — `SKILL.md`（ローカル / GitHub）や Streamable HTTP MCP サーバー（カスタムヘッダー / MCP OAuth 2.0 PKCE 対応）。

---

## AI コーディング時代のための設計

複数の AI エージェントが同時に異なるブランチや Worktree で作業すると、Git の状態はすぐに煩雑になります。Yggit は次の機能で開発を整理します：

- **並列 Worktree & エージェント状況の可視化** — アクティブな Worktree、未マージコミット、ブランチの分岐状態を一元管理。
- **同期ずれ・コンフリクトの早期検知** — リモートとの差分や 3-way マージコンフリクトのリスクを事前に特定。
- **AI による Diff と履歴の理解** — Yggi が変更内容の要約やマージ経路の追跡を支援。
- **10 言語の UI ローカライズ** — 英語・簡体字中国語・繁体字中国語・日本語・韓国語・フランス語・ドイツ語・スペイン語・ブラジルポルトガル語・ロシア語に対応。

---

## 実行形態

Yggit は 3 つの実行形態（`YGGIT_SERVICE`）で同じワークスペース体験を提供します：

| 形態               | 動作方式                                              | ディスク & Git アクセス                                                                                |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Local**          | リポジトリ横で動く Node.js サーバー                   | ネイティブ Git CLI、ローカル読み書き、暗号化ストレージ、ローカル CLI エージェント連携                  |
| **Desktop App**    | スタンドアロン Electron アプリ（`YGGIT_SERVICE=app`） | ネイティブ Git CLI、ローカル読み書き、デスクトップ統合                                                 |
| **Edge / Browser** | ブラウザ直接実行（`YGGIT_SERVICE=remote`）            | サーバーディスク不要 — Chromium の File System Access API と `isomorphic-git` でローカルフォルダを開く |

---

## プライバシー設計

- **アカウント登録不要**：サインアップやテレメトリなしですぐに利用できます。
- **データはローカルに保持**：リポジトリデータや暗号化済みトークンは端末内に保存されます。
- **明確な外部送信境界**：ユーザーが設定した外部 LLM / MCP エンドポイントにのみ送信され、クライアント側リダクションを併用できます。詳細はアプリ内の `/settings/privacy` を参照してください。

---

## はじめに

**Node.js ≥ 22.19.0** および **pnpm** が必要です。

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

ブラウザで [http://localhost:3000](http://localhost:3000)（または起動ログに表示される LAN URL）を開きます。

<details>
<summary>開発・テスト・デスクトップアプリビルド用コマンド一覧</summary>

| コマンド            | 用途                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | 開発サーバーを起動（デフォルトで LAN 待受）                                                          |
| `pnpm dev:lan`      | LAN モードで開発サーバーを起動                                                                       |
| `pnpm dev:loopback` | ループバック（`127.0.0.1`）のみで起動                                                                |
| `pnpm build`        | 本番 Next.js バンドルをビルド                                                                        |
| `pnpm build:app`    | スタンドアロン App バンドルと `.electron-builder/app-root` を生成                                    |
| `pnpm dist:mac`     | macOS 用 `.app` とリリース `.zip`（`x64` + `arm64`）を作成                                           |
| `pnpm dist:win`     | Windows 用 NSIS インストーラー（`.exe`）を作成                                                       |
| `pnpm dist:dir`     | ローカル検証用の非圧縮アプリディレクトリを出力                                                       |
| `pnpm electron`     | Next 開発サーバーに対して Electron シェルを起動                                                      |
| `pnpm start`        | 本番サーバーを起動                                                                                   |
| `pnpm ok`           | `fix:imports`、Prettier、ESLint（`--max-warnings=0`）、型チェック、Jest テスト、本番ビルドを一括実行 |
| `pnpm ok:ci`        | CI 検証パイプラインを実行                                                                            |

</details>

## ドキュメント

- [ドキュメント索引](../README.md) — アーキテクチャ仕様、PRD、UX ガイド、コーディング規約。

## コントリビューション

PR や Issue の投稿を歓迎します！事前に [CONTRIBUTING.md](../../CONTRIBUTING.md) をご確認ください。セキュリティ上の脆弱性については [SECURITY.md](../../SECURITY.md) に従ってご報告ください。

## ライセンス

Yggit は [MIT ライセンス](../../LICENSE) のもとで公開されているオープンソースソフトウェアです。
