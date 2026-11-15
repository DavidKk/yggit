export type PickKind = 'folder' | 'app' | 'game' | 'file'

export type PickResult = { ok: true; path: string; paths: string[] } | { ok: false; cancelled: true } | { ok: false; error: string }

export type PickPathOptions = {
  /** Allow selecting multiple folders. */
  multiple?: boolean
}

/** 原生路径选择：同一能力，按 OS × lane 换实现 */
export interface PickPathCapability {
  readonly id: 'pickPath'
  pick(kind: PickKind, prompt?: string, options?: PickPathOptions): Promise<PickResult>
}
