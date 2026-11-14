import { join } from 'node:path'

export const ROOT_PATH = join(process.cwd(), '.jest-yggit-root')
export const DATA_DIR = join(ROOT_PATH, 'data')
