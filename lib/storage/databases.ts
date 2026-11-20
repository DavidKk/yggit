// Keep existing names stable so stored directory handles and caches remain available.
export const APP_DATABASE_PREFIX = 'yggit_'
export const HANDLES_DATABASE = `${APP_DATABASE_PREFIX}handles_store`
export const CONFLICTS_DATABASE = `${APP_DATABASE_PREFIX}conflicts_cache`
export const APP_DATABASE_NAMES: readonly string[] = [HANDLES_DATABASE, CONFLICTS_DATABASE]
