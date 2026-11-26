import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentRu: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Перетащите для перемещения',
    barPlaceholder: 'Спросить Yggi (например, сегодняшние слияния / проверка веток)...',
    settingsTitle: 'Настройки',
    tabModels: 'Модели',
    tabPrivacy: 'Приватность и маскирование',
    tabGeneral: 'Общие',
    tabShortcuts: 'Горячие клавиши',
    testConnection: 'Проверить соединение',
    testSuccess: 'Соединение успешно',
    testFailed: 'Ошибка соединения',
    dockTitle: 'Yggi',
    deepDiscussion: 'Закрепить для обсуждения',
    welcomeTitle: 'Добро пожаловать в Yggi',
    welcomeDesc: 'Спрашивайте о статистике веток, проверке слияний, истории коммитов и диагностике репозитория.',
  },
}
