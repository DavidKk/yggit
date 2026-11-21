// Keep existing names stable so stored directory handles and caches remain available.
export const APP_DATABASE_PREFIX = 'yggit_'
export const HANDLES_DATABASE = `${APP_DATABASE_PREFIX}handles_store`
export const CONFLICTS_DATABASE = `${APP_DATABASE_PREFIX}conflicts_cache`
export const SKILLS_DATABASE = `${APP_DATABASE_PREFIX}skills_store`
export const MCP_DATABASE = `${APP_DATABASE_PREFIX}mcp_store`
export const LOGS_DATABASE = `${APP_DATABASE_PREFIX}logs_store`
export const TASKS_DATABASE = `${APP_DATABASE_PREFIX}tasks_store`

export const APP_DATABASE_NAMES: readonly string[] = [HANDLES_DATABASE, CONFLICTS_DATABASE, SKILLS_DATABASE, MCP_DATABASE, LOGS_DATABASE, TASKS_DATABASE]
