import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentDe: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Zum Verschieben ziehen',
    barPlaceholder: 'Yggi fragen (z. B. heutige Merges / Branch-Verschmutzung)...',
    settingsTitle: 'Einstellungen',
    tabModels: 'Modellanbieter',
    tabPrivacy: 'Datenschutz & Maskierung',
    tabGeneral: 'Allgemein',
    tabShortcuts: 'Tastenkürzel',
    testConnection: 'Verbindung testen',
    testSuccess: 'Verbindung erfolgreich',
    testFailed: 'Verbindung fehlgeschlagen',
    dockTitle: 'Yggi',
    deepDiscussion: 'Andocken zum Diskutieren',
    welcomeTitle: 'Willkommen bei Yggi',
    welcomeDesc: 'Fragen Sie nach Branch-Statistiken, Merge-Prüfungen, Commit-Logs oder Repository-Diagnosen.',
  },
}
