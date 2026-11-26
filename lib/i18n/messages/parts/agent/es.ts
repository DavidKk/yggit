import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentEs: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Arrastra para mover',
    barPlaceholder: 'Preguntar a Yggi (ej: merges de hoy / revisión de ramas)...',
    settingsTitle: 'Configuración',
    tabModels: 'Modelos',
    tabPrivacy: 'Privacidad y Redacción',
    tabGeneral: 'General',
    tabShortcuts: 'Atajos',
    testConnection: 'Probar conexión',
    testSuccess: 'Conexión exitosa',
    testFailed: 'Error de conexión',
    dockTitle: 'Yggi',
    deepDiscussion: 'Acoplar para debatir',
    welcomeTitle: 'Bienvenido a Yggi',
    welcomeDesc: 'Pregunta sobre estadísticas de ramas, detección de merges, historial de commits o diagnósticos.',
  },
}
