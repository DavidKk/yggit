'use client'

import React, { useState } from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { Modal } from '@/components/sk'
import { useAgent } from '@/lib/agent/agent-context'

import { ModelChannelSection } from './ModelChannelSection'
import { PrivacyRedactSection } from './PrivacyRedactSection'
import { type SettingsSectionKey, SettingsSideNav } from './SettingsSideNav'
import { ShortcutsSection } from './ShortcutsSection'

export function AgentSettingsModal() {
  const t = useT()
  const { isSettingsOpen, setIsSettingsOpen } = useAgent()
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('models')

  if (!isSettingsOpen) return null

  return (
    <Modal
      open={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      title={t('gitAgent.settingsTitle')}
      panelClassName="max-w-3xl w-full p-0 overflow-hidden"
      bodyClassName="p-0"
      scrollBody={false}
    >
      <div className="flex min-h-[460px] max-h-[75vh] w-full">
        {/* Left Sub-navigation Rail */}
        <SettingsSideNav activeSection={activeSection} onSelectSection={setActiveSection} />

        {/* Right Content Area (left-aligned) */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'models' && <ModelChannelSection />}
          {activeSection === 'privacy' && <PrivacyRedactSection />}
          {activeSection === 'shortcuts' && <ShortcutsSection />}
        </div>
      </div>
    </Modal>
  )
}
