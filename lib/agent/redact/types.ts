/**
 * Redaction categories supported by the engine.
 */
export type RedactionCategory = 'secrets' | 'pii' | 'network' | 'custom'

/**
 * Individual redaction rule definition.
 */
export interface RedactionRule {
  id: string
  name: string
  category: RedactionCategory
  pattern: RegExp
  placeholderPrefix: string
  enabled: boolean
}

/**
 * Custom sensitive word configuration.
 */
export interface CustomRedactionWord {
  word: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

/**
 * Configuration options for the redaction engine.
 */
export interface RedactionOptions {
  enabled: boolean
  categories: {
    secrets: boolean
    pii: boolean
    network: boolean
    custom: boolean
  }
  customWords: CustomRedactionWord[]
  allowList: string[]
}

/**
 * Result of a text redaction operation.
 */
export interface RedactionResult {
  sanitizedText: string
  replacementsCount: number
}

/**
 * In-memory state tracking placeholders and their original secret values.
 */
export interface RedactionSession {
  sessionId: string
  placeholderToOriginal: Map<string, string>
  originalToPlaceholder: Map<string, string>
  counters: Record<string, number>
}
