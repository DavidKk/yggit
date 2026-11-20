import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentFr: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Faire glisser pour déplacer',
    barPlaceholder: 'Poser une question à Git Agent (ex: merges du jour, pollution de branche)...',
    settingsTitle: 'Paramètres',
    tabModels: 'Modèles',
    tabPrivacy: 'Confidentialité',
    tabGeneral: 'Général',
    tabShortcuts: 'Raccourcis',
    testConnection: 'Tester la connexion',
    testSuccess: 'Connexion réussie',
    testFailed: 'Échec de connexion',
    dockTitle: 'Yggit · Agent',
    deepDiscussion: 'Ancrer pour discuter',
  },
}
