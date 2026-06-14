import assert from 'node:assert/strict'
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from '@supabase/supabase-js'
import {
  classifyAuthError,
  classifySessionValidity,
  isConfirmedStaffSessionEnded,
} from '../lib/auth/sessionVerification.ts'

assert.equal(classifyAuthError(new AuthSessionMissingError()), 'invalid')
assert.equal(classifyAuthError(new AuthInvalidJwtError('Invalid JWT')), 'invalid')
assert.equal(
  classifyAuthError(new AuthApiError('Session not found', 403, 'session_not_found')),
  'invalid',
)
assert.equal(
  classifyAuthError(new AuthApiError('Refresh token not found', 400, 'refresh_token_not_found')),
  'invalid',
)
assert.equal(classifyAuthError(new AuthRetryableFetchError('Network unavailable', 0)), 'unavailable')
assert.equal(
  classifyAuthError(new AuthApiError('Request timeout', 504, 'request_timeout')),
  'unavailable',
)
assert.equal(classifyAuthError(new Error('Database unavailable')), 'unavailable')

assert.equal(classifySessionValidity(true, null), 'valid')
assert.equal(classifySessionValidity(false, null), 'invalid')
assert.equal(
  classifySessionValidity(null, { code: 'PGRST000', message: 'Database unavailable' }),
  'unavailable',
)

assert.equal(
  isConfirmedStaffSessionEnded({
    code: 'P0001',
    message: 'Staff session has ended',
  }),
  true,
)
assert.equal(
  isConfirmedStaffSessionEnded({
    code: 'PGRST000',
    message: 'Database unavailable',
  }),
  false,
)

console.log('staff session verification tests passed')
