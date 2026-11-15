import type { RedactionRule } from './types'

/**
 * Built-in redaction rules for detecting sensitive credentials, PII, and network topology.
 */
export const BUILTIN_REDACTION_RULES: RedactionRule[] = [
  // 1. Secrets & Credentials
  {
    id: 'openai-key',
    name: 'OpenAI API Key',
    category: 'secrets',
    pattern: /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
    placeholderPrefix: 'OPENAI_KEY',
    enabled: true,
  },
  {
    id: 'github-token',
    name: 'GitHub Personal Access Token',
    category: 'secrets',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,}\b/g,
    placeholderPrefix: 'GH_TOKEN',
    enabled: true,
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    category: 'secrets',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholderPrefix: 'AWS_KEY',
    enabled: true,
  },
  {
    id: 'private-key',
    name: 'Private Key Block',
    category: 'secrets',
    pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
    placeholderPrefix: 'PRIVATE_KEY',
    enabled: true,
  },
  {
    id: 'db-connection-uri',
    name: 'Database Connection URI',
    category: 'secrets',
    pattern: /\b(?:postgres|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]+@[^\s"'>\r\n]+/gi,
    placeholderPrefix: 'DB_URI',
    enabled: true,
  },
  {
    id: 'bearer-jwt',
    name: 'Bearer JWT Token',
    category: 'secrets',
    pattern: /\bBearer\s+eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    placeholderPrefix: 'JWT_TOKEN',
    enabled: true,
  },

  // 2. Personal Identifiable Information (PII)
  {
    id: 'email-address',
    name: 'Email Address',
    category: 'pii',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    placeholderPrefix: 'USER_EMAIL',
    enabled: true,
  },

  // 3. Internal Network Topology
  {
    id: 'ipv4-private',
    name: 'Private IPv4 Address',
    category: 'network',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    placeholderPrefix: 'INTERNAL_IP',
    enabled: true,
  },
  {
    id: 'internal-domain',
    name: 'Internal Domain Names',
    category: 'network',
    pattern: /\b[a-zA-Z0-9-]+\.(?:corp|internal|local|lan)\b/g,
    placeholderPrefix: 'INTERNAL_DOMAIN',
    enabled: true,
  },
]

/**
 * Checks if a string looks like a standard Git commit hash (7 to 40 hex characters)
 * to avoid false positive redaction.
 */
export function isLikelyGitCommitHash(text: string): boolean {
  return /^[0-9a-fA-F]{7,40}$/.test(text.trim())
}
