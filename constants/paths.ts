import { resolve } from 'node:path'

export const ROOT_PATH = process.cwd()
export const DATA_DIR_NAME = 'data'
export const DATA_DIR = resolve(ROOT_PATH, DATA_DIR_NAME)
