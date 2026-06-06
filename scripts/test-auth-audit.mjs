import assert from 'node:assert/strict'
import { sanitizeAuditData } from '../lib/auth/audit.ts'

assert.deepEqual(
  sanitizeAuditData({
    name: 'Lina',
    password: 'secret',
    access_token: 'token',
    nested: {
      refresh_token: 'token',
      status: 'active',
      cookieValue: 'private',
    },
  }),
  {
    name: 'Lina',
    nested: { status: 'active' },
  }
)

assert.deepEqual(
  sanitizeAuditData({
    note: 'x'.repeat(700),
    rows: Array.from({ length: 80 }, (_, index) => ({ index })),
  }),
  {
    note: 'x'.repeat(500),
    rows: Array.from({ length: 50 }, (_, index) => ({ index })),
  }
)

console.log('audit sanitization tests passed')
