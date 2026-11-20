import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentDe: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Zum Verschieben ziehen',
    barPlaceholder: 'Git Agent fragen (z. B. heutige Merges / Branch-Verschmutzung)...',
    settingsTitle: 'Einstellungen',
    tabModels: 'Modellanbieter',
    tabPrivacy: 'Datenschutz & Maskierung',
    tabGeneral: 'Allgemein',
    tabShortcuts: 'Tastenkürzel',
    testConnection: 'Verbindung testen',
    testSuccess: 'Verbindung erfolgreich',
    testFailed: 'Verbindung fehlgeschlagen',
    dockTitle: 'Yggit · Agent',
    deepDiscussion: 'Andocken zum Diskutieren',
  },
}
