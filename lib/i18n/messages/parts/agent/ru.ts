import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentRu: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Перетащите для перемещения',
    barPlaceholder: 'Спросить Git Agent (например, сегодняшние слияния / проверка веток)...',
    settingsTitle: 'Настройки',
    tabModels: 'Модели',
    tabPrivacy: 'Приватность и маскирование',
    tabGeneral: 'Общие',
    tabShortcuts: 'Горячие клавиши',
    testConnection: 'Проверить соединение',
    testSuccess: 'Соединение успешно',
    testFailed: 'Ошибка соединения',
    dockTitle: 'Yggit · Agent',
    deepDiscussion: 'Закрепить для обсуждения',
  },
}
