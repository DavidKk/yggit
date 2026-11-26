<div align="center">

<img src="../../public/world-tree-assets/hero/hero_day_master_1672x941.webp" alt="Yggit — 세계수 Git 그래프 & AI 저장소 워크벤치" width="840" />

# Yggit

**Your Git history, brought to life.**

Git 히스토리를 시각화하고, Worktree를 관리하며, 저장소 문제를 사전에 발견하고 AI로 코드를 이해하세요. AI 코딩 시대를 위해 설계된 오픈소스 로컬 우선(Local-first) Git 워크스페이스입니다.

**설치 불필요 · 회원가입 불필요 · 오픈소스 · 로컬 우선**

<p>
  <a href="https://yggit.vercel.app"><strong>온라인 체험</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/DavidKk/yggit/releases"><strong>앱 다운로드</strong></a>
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

## 왜 Yggit인가요?

현대 소프트웨어 개발에서는 여러 저장소, 병렬 브랜치, 독립적인 Worktree, 그리고 다수의 AI 코딩 에이전트가 동시에 코드를 수정하는 일이 일상화되었습니다. 기존 Git 클라이언트는 딱딱한 격자형 그래프나 단순 Diff 확인에 머무르는 경우가 많습니다.

Yggit은 **유기적인 세계수 커밋 그래프**, **능동적 저장소 진단**, 그리고 **개방형 로컬 우선 AI 어시스턴트**를 하나의 워크스페이스에 담아 브라우저, 로컬 서버, 독립 실행형 데스크톱 앱으로 제공합니다.

---

## 핵심 기능

### Git, brought to life — 세계수 Git 히스토리 시각화

딱딱한 지하철 노선도 대신 **유기적 세계수 DAG**로 커밋 흐름을 보여줍니다. 부드러운 3차 베지어 곡선 병합, 줄기와 가지의 두께 계층, 틈새 없는 날짜 구분선, 의미론적 노드 마커(Stash 캡슐, HEAD 펄스 링, 병합 노드)로 복잡한 히스토리를 한눈에 파악할 수 있습니다.

### Meet Yggi — AI 저장소 어시스턴트

드래그 가능한 플로팅 알약, 빠른 응답 카드, 크기 조절 가능한 사이드바 형태로 동작합니다. 브랜치 통계, 커밋 Diff, 병합 이력을 질문하고, 커밋 메시지를 생성하며, Fact / Derived / Hypothesis 근거 등급이 포함된 **Agent Spotlight** 하이라이트를 그래프에서 바로 확인할 수 있습니다.

### Stay ahead of Git problems — Workdesk 능동 진단

**Workdesk**가 저장소를 지속적으로 스캔하여 브랜치 동기화 불일치, 푸시 전 리뷰 대기 변경사항, 분기된 브랜치, 병렬 Worktree 정리, 네이밍·구조 위생 문제를 충돌 전에 미리 포착합니다.

### One workspace, many repositories — 멀티 저장소 & Worktree 관리

로컬 및 원격 저장소를 손쉽게 전환하고, 브랜치 컨텍스트 메뉴(자주 쓰는 작업 고정, 계단식 하위 메뉴, 위험 작업 2단계 확인, 저장소 기능 기반 자동 필터링)를 원하는 대로 구성할 수 있습니다.

### Your code stays yours — 로컬 우선 & 프라이버시 보호

**Local-first 아키텍처**: 저장소 인덱스, 캐시, 암호화된 API 인증 정보는 모두 사용자 기기에만 저장됩니다. 외부 모델로 전송되기 전에 민감한 토큰·이메일·사용자 지정 키워드를 가역적으로 마스킹하는 클라이언트 측 마스킹 기능도 내장되어 있습니다.

### Bring your own AI — 개방형 AI 모델 & MCP 생태계

특정 벤더에 종속되지 않고 원하는 AI 런타임을 연결할 수 있습니다:

- **Browser AI** — Chrome 내장 Gemini Nano.
- **Browser Local AI** — 브라우저에서 직접 실행되는 WebGPU / WASM 오프라인 오픈 모델.
- **로컬 CLI Agent** — Claude, Codex, Gemini, Cursor, Antigravity CLI 어댑터.
- **OpenAI 호환 & 클라우드 API** — DeepSeek, OpenAI, Claude, Ollama 및 커스텀 게이트웨이(와일드카드 허용/차단 필터 지원).
- **Skills & HTTP MCP** — `SKILL.md`(로컬/GitHub) 및 Streamable HTTP MCP 서버(커스텀 헤더 / MCP OAuth 2.0 PKCE 지원).

---

## AI 코딩 시대를 위한 설계

여러 AI 에이전트가 동시에 서로 다른 브랜치와 Worktree에서 작업할 때 Git 상태는 빠르게 복잡해집니다. Yggit은 다음 기능으로 흐름을 명확하게 유지합니다:

- **병렬 Worktree & 에이전트 가시성** — 활성 Worktree, 미병합 커밋, 브랜치 분기 상태를 한곳에서 추적합니다.
- **선제적 동기화 & 충돌 감지** — 원격과의 차이, 푸시되지 않은 변경사항, 3-way 병합 충돌 위험을 조기에 발견합니다.
- **AI 기반 Diff 및 히스토리 이해** — Yggi를 통해 변경 사항 요약과 병합 경로 추적을 수행합니다.
- **10개 언어 완벽 지원** — 영어, 중국어(간체/번체), 일본어, 한국어, 프랑스어, 독일어, 스페인어, 포르투갈어(브라질), 러시아어를 지원합니다.

---

## 실행 모드

Yggit은 동일한 워크스페이스 경험을 3가지 실행 모드(`YGGIT_SERVICE`)로 제공합니다:

| 모드               | 방식                                                   | 디스크 및 Git 접근                                                                         |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Local**          | 저장소 옆에서 실행되는 Node.js 서버                    | 전체 네이티브 Git CLI, 로컬 파일 접근, 암호화 로컬 저장소, 로컬 CLI 에이전트 연동          |
| **Desktop App**    | 독립 실행형 Electron 데스크톱 앱 (`YGGIT_SERVICE=app`) | 전체 네이티브 Git CLI, 로컬 파일 접근 및 데스크톱 셸 통합                                  |
| **Edge / Browser** | 브라우저 무설치 모드 (`YGGIT_SERVICE=remote`)          | 서버 디스크 없음 — Chromium의 File System Access API와 `isomorphic-git`으로 로컬 폴더 열기 |

---

## 프라이버시 설계 원칙

- **계정 불필요**: 회원가입이나 텔레메트리 없이 즉시 사용할 수 있습니다.
- **로컬 우선 저장**: 저장소 데이터, 캐시, 암호화된 토큰은 사용자 기기에만 보관됩니다.
- **명확한 외부 경계**: 사용자가 직접 설정한 외부 LLM / MCP 엔드포인트로만 요청이 전송되며, 클라이언트 측 마스킹을 선택적으로 적용할 수 있습니다. 자세한 내용은 앱 내 `/settings/privacy`를 참고하세요.

---

## 시작하기

**Node.js ≥ 22.19.0** 및 **pnpm**이 필요합니다.

```bash
git clone https://github.com/DavidKk/yggit.git
cd yggit
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)(또는 시작 로그의 LAN URL)을 열어 바로 사용할 수 있습니다.

<details>
<summary>개발, 테스트 및 데스크톱 앱 빌드 명령어 보기</summary>

| 명령어              | 용도                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | 개발 서버 시작 (기본 LAN 수신)                                                                       |
| `pnpm dev:lan`      | 명시적 LAN 개발 서버 실행                                                                            |
| `pnpm dev:loopback` | 루프백(`127.0.0.1`) 전용 개발 서버 실행                                                              |
| `pnpm build`        | 프로덕션 Next.js 번들 빌드                                                                           |
| `pnpm build:app`    | 독립 실행형 App 번들 빌드 및 `.electron-builder/app-root` 구성                                       |
| `pnpm dist:mac`     | macOS `.app` 및 배포 `.zip` (`x64` + `arm64`) 패키징                                                 |
| `pnpm dist:win`     | Windows NSIS 설치 파일 (`.exe`) 패키징                                                               |
| `pnpm dist:dir`     | 로컬 테스트용 비압축 데스크톱 앱 디렉터리 패키징                                                     |
| `pnpm electron`     | Next 개발 서버에 연결하여 Electron 셸 실행                                                           |
| `pnpm start`        | 프로덕션 서버 시작                                                                                   |
| `pnpm ok`           | `fix:imports`, Prettier, ESLint(`--max-warnings=0`), 타입 체크, Jest 테스트, 프로덕션 빌드 일괄 실행 |
| `pnpm ok:ci`        | CI 검증 파이프라인 실행                                                                              |

</details>

## 문서

- [문서 색인](../README.md) — 아키텍처 명세, PRD, UX 가이드 및 코딩 표준.

## 기여하기

기여를 환영합니다! PR을 열기 전에 [CONTRIBUTING.md](../../CONTRIBUTING.md)를 읽어주시고, 버그 제보나 기능 요청은 [GitHub Issues](https://github.com/DavidKk/yggit/issues)를 이용해 주세요. 보안 취약점은 [SECURITY.md](../../SECURITY.md)에 따라 비공개로 제보해 주세요.

## 라이선스

Yggit은 [MIT 라이선스](../../LICENSE)에 따라 배포되는 오픈소스 소프트웨어입니다.
