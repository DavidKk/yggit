import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentEs: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Arrastra para mover',
    barPlaceholder: 'Preguntar a Git Agent (ej: merges de hoy / revisión de ramas)...',
    settingsTitle: 'Configuración',
    tabModels: 'Modelos',
    tabPrivacy: 'Privacidad y Redacción',
    tabGeneral: 'General',
    tabShortcuts: 'Atajos',
    testConnection: 'Probar conexión',
    testSuccess: 'Conexión exitosa',
    testFailed: 'Error de conexión',
    dockTitle: 'Yggit · Agent',
    deepDiscussion: 'Acoplar para debatir',
  },
}
