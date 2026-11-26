import type { GitAgentMessages } from '@/lib/i18n/messages/agent-types'

import { gitAgentEn } from './en'

export const gitAgentPtBR: { gitAgent: GitAgentMessages } = {
  gitAgent: {
    ...gitAgentEn.gitAgent,
    barDragHint: 'Arraste para reposicionar',
    barPlaceholder: 'Perguntar ao Yggi (ex: merges de hoje / verificação de branches)...',
    settingsTitle: 'Configurações',
    tabModels: 'Provedor de Modelos',
    tabPrivacy: 'Privacidade e Redação',
    tabGeneral: 'Geral',
    tabShortcuts: 'Atalhos',
    testConnection: 'Testar conexão',
    testSuccess: 'Conexão bem-sucedida',
    testFailed: 'Falha na conexão',
    dockTitle: 'Yggi',
    deepDiscussion: 'Fixar para discutir',
    welcomeTitle: 'Bem-vindo ao Yggi',
    welcomeDesc: 'Pergunte sobre estatísticas de branches, detecção de merges, histórico de commits ou diagnósticos.',
  },
}
