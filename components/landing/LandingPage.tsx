'use client'

import Link from 'next/link'
import React from 'react'
import { LuArrowRight, LuCheck, LuFolderGit2, LuGitBranch, LuGlobe, LuHardDrive, LuLock, LuSettings, LuShieldCheck, LuZap } from 'react-icons/lu'

import { BrandLogo } from '@/components/BrandLogo'
import { YggitOfficialPreview } from '@/components/homepage/YggitOfficialPreview'
import { useT } from '@/components/i18n/LocaleProvider'
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher'
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'

export function LandingPage() {
  const t = useT()

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-paper text-ink selection:bg-accent selection:text-white">
      {/* 1. Standalone Official Landing Navigation Header */}
      <header className="sticky top-0 z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-line/80 bg-paper/85 px-4 sm:px-8 backdrop-blur-md transition-all">
        <div className="flex items-center gap-3">
          <BrandLogo href="/" markClassName="size-7" wordmarkClassName="text-base font-bold" />
          <span className="hidden items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[0.68rem] font-semibold text-accent sm:inline-flex">v2.0</span>
        </div>

        {/* Anchor Navigation Links */}
        <nav className="hidden items-center gap-6 text-xs font-medium text-ink-soft sm:flex">
          <a href="#features" className="transition-colors hover:text-ink">
            特性矩阵
          </a>
          <a href="#living-banner" className="transition-colors hover:text-ink">
            生命画卷
          </a>
          <a href="#architecture" className="transition-colors hover:text-ink">
            双引擎架构
          </a>
          <a href="#privacy" className="transition-colors hover:text-ink">
            端侧脱敏
          </a>
          <Link href="/settings" className="transition-colors hover:text-ink">
            {t('gitAgent.settingsTitle')}
          </Link>
          {process.env.NODE_ENV === 'development' && (
            <Link href="/dev/studio" className="transition-colors text-accent hover:text-accent/80 font-mono font-medium">
              动效工坊
            </Link>
          )}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <LocaleSwitcher compact />
          <span className="h-4 w-px bg-line" aria-hidden="true" />
          <Link
            href="/git"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[color-mix(in_oklab,var(--accent)_88%,black)] hover:shadow-accent/25 active:scale-95"
          >
            <LuFolderGit2 className="size-3.5" aria-hidden="true" />
            <span>进入工作区</span>
            <LuArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* 2. Official Living World Tree Hero Banner */}
      <section id="living-banner" className="relative w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-12">
        <YggitOfficialPreview view="official-site" compactBannerMode />
      </section>

      {/* 4. Core Features Grid */}
      <section id="features" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-xs font-semibold tracking-wider text-accent uppercase">核心技术特性</h2>
          <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">重新定义 Git 交互式研发生态</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="flex flex-col rounded-xl border border-line bg-paper-2 p-5 shadow-xs transition-all hover:border-accent/40 hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent mb-4">
              <LuZap className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">双引擎驱动架构</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">原生支持 Node.js 服务端极速索引与 Edge 浏览器原生 File System Access API。自由切换，零依赖即开即用。</p>
          </div>

          {/* Card 2 */}
          <div className="flex flex-col rounded-xl border border-line bg-paper-2 p-5 shadow-xs transition-all hover:border-accent/40 hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#10b981]/15 text-[#10b981] mb-4">
              <LuGitBranch className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">3秒分支聚光灯</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">自研 DAG 拓扑算法，毫秒级布局海量提交。悬停分支 3 秒智能淡化无关节点与连线，合并脉络一眼辨析。</p>
          </div>

          {/* Card 3 */}
          <div className="flex flex-col rounded-xl border border-line bg-paper-2 p-5 shadow-xs transition-all hover:border-accent/40 hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#06b6d4]/15 text-[#06b6d4] mb-4">
              <LuShieldCheck className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">端侧可逆脱敏 AI</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">客户端内存完成凭据、邮箱与拓扑双向可逆掩盖，防范敏感代码外泄。接入 OpenAI、Claude、Gemini 及本地大模型。</p>
          </div>

          {/* Card 4 */}
          <div className="flex flex-col rounded-xl border border-line bg-paper-2 p-5 shadow-xs transition-all hover:border-accent/40 hover:shadow-md">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] mb-4">
              <LuFolderGit2 className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-ink">多工作区与语义分享</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">集中管理本地多个仓库目录，支持一键生成精准定位到文件与行号的 Markdown 排查卡片与跨团队语义共享链接。</p>
          </div>
        </div>
      </section>

      {/* 5. Driver Architecture Comparison */}
      <section id="architecture" className="border-t border-line/70 bg-panel/40 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-xs font-semibold tracking-wider text-accent uppercase">双引擎对比与设计</h2>
            <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Local 极致效能 · Edge 随处运行</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Local Driver Card */}
            <div className="rounded-xl border border-line bg-paper p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <LuHardDrive className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Local 本地驱动 (Node.js)</h3>
                  <p className="text-[0.75rem] text-ink-soft">适合日常开发环境与重型大型工程</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-ink-soft">
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>原生 Git CLI 极速吞吐，毫秒级加载数万条提交历史</span>
                </li>
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>支持完整 Git Worktree 多工作区并发切换</span>
                </li>
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>多目录自动扫描嗅探与实时文件系统事件监听</span>
                </li>
              </ul>
            </div>

            {/* Edge Driver Card */}
            <div className="rounded-xl border border-line bg-paper p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[#06b6d4]/15 text-[#06b6d4]">
                  <LuGlobe className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Edge 边缘驱动 (Browser Native)</h3>
                  <p className="text-[0.75rem] text-ink-soft">零依赖部署与临时排查利器</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-ink-soft">
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>无需本地运行 Node 服务，浏览器直接使用 File System Access 打开</span>
                </li>
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>基于 Isomorphic-Git 与纯前端 WASM 解析，沙箱隔离运行</span>
                </li>
                <li className="flex items-center gap-2">
                  <LuCheck className="size-4 text-ok shrink-0" />
                  <span>支持通过分享 URL 直接打开远程 Git 仓库进行只读审计</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Privacy & Redaction Section */}
      <section id="privacy" className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-ok/15 text-ok mb-4">
          <LuLock className="size-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">客户端零存留隐私保护</h2>
        <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm text-ink-soft leading-relaxed">
          代码是企业的核心资产。Yggit 的 AI Agent 采用端侧双向脱敏架构，出站请求前自动匹配敏感 Token、密钥、内部域名与作者邮箱，
          仅以匿名掩码与大模型交互。模型流式返回时在浏览器内存即时还原，代码与密钥永不落盘。
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/settings/privacy"
            className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2 text-xs font-semibold text-ink hover:bg-panel transition-colors"
          >
            <LuSettings className="size-3.5 text-accent" />
            <span>前往配置隐私脱敏规则</span>
          </Link>
        </div>
      </section>

      {/* 7. Bottom Call to Action */}
      <section className="border-t border-line bg-panel-2/70 px-4 py-14 text-center sm:px-6">
        <h2 className="text-xl font-bold sm:text-2xl">立即开启现代化的 Git 协同体验</h2>
        <p className="mt-2 text-xs sm:text-sm text-ink-soft">轻量、纯粹、敏捷，告别臃肿缓慢的传统桌面客户端。</p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/git"
            className="flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all hover:bg-[color-mix(in_oklab,var(--accent)_88%,black)] active:scale-95"
          >
            <LuFolderGit2 className="size-4" />
            <span>立即进入 Git 工作区</span>
          </Link>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="mt-auto border-t border-line/60 bg-paper py-8 px-4 text-xs text-ink-soft sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandLogo href="/" markClassName="size-5" wordmarkClassName="text-xs font-bold" />
            <span>— 世界树 Git 图谱与版本协同工具</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/git" className="hover:text-ink transition-colors">
              {t('workdesk.title')}
            </Link>
            <Link href="/git" className="hover:text-ink transition-colors">
              工作区
            </Link>
            <Link href="/settings" className="hover:text-ink transition-colors">
              {t('gitAgent.settingsTitle')}
            </Link>
            <a href="https://github.com/DavidKk/yggit" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">
              GitHub
            </a>
          </div>

          <div>
            <span>© {new Date().getFullYear()} Yggit Team. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
