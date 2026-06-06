const PRIVATE_KEY_PATTERN = /password|token|secret|authorization|cookie/i
const MAX_DEPTH = 6
const MAX_ARRAY_LENGTH = 50
const MAX_STRING_LENGTH = 500

function sanitize(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[Truncated]'
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH)
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map(item => sanitize(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !PRIVATE_KEY_PATTERN.test(key))
        .map(([key, item]) => [key, sanitize(item, depth + 1)])
    )
  }
  return String(value).slice(0, MAX_STRING_LENGTH)
}

export function sanitizeAuditData<T>(value: T): T {
  return sanitize(value, 0) as T
}
