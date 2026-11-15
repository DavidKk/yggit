'use client'

import React from 'react'
import { LuCommand, LuCornerDownLeft, LuNavigation, LuX } from 'react-icons/lu'

import { useT } from '@/components/i18n/LocaleProvider'

export function ShortcutsSection() {
  const t = useT()

  const shortcuts = [
    {
      keys: ['⌘', 'J'],
      altKeys: ['Ctrl', 'J'],
      description: t('gitAgent.shortcutHint'),
      icon: <LuCommand className="h-4 w-4 text-accent" />,
    },
    {
      keys: ['Enter'],
      description: '发送提问 / 执行 Git 诊断分析',
      icon: <LuCornerDownLeft className="h-4 w-4 text-emerald-500" />,
    },
    {
      keys: ['p', '/', 'n'],
      description: '在提交聚焦模式下切换上一个 / 下一个关键提交',
      icon: <LuNavigation className="h-4 w-4 text-blue-500" />,
    },
    {
      keys: ['Esc'],
      description: '收起输入条 / 退出提交聚焦点亮模式',
      icon: <LuX className="h-4 w-4 text-muted-foreground" />,
    },
  ]

  return (
    <div className="flex flex-col gap-4 max-w-2xl text-left">
      <div className="space-y-1">
        <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('gitAgent.tabShortcuts')}</h4>
        <p className="text-xs text-muted-foreground">支持全局快捷键与图谱巡检热键无缝联动。</p>
      </div>

      <div className="divide-y divide-border/40 rounded-lg border border-border/70 bg-background">
        {shortcuts.map((sc, idx) => (
          <div key={idx} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2.5">
              {sc.icon}
              <span className="text-xs text-foreground font-medium">{sc.description}</span>
            </div>
            <div className="flex items-center gap-1">
              {sc.keys.map((k, kIdx) => (
                <kbd key={kIdx} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground shadow-xs">
                  {k}
                </kbd>
              ))}
              {sc.altKeys && (
                <>
                  <span className="text-[11px] text-muted-foreground/60 mx-1">或</span>
                  {sc.altKeys.map((ak, akIdx) => (
                    <kbd key={akIdx} className="rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground shadow-xs">
                      {ak}
                    </kbd>
                  ))}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
