import {
  isAuthError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js'

export type SessionVerificationStatus = 'valid' | 'invalid' | 'unavailable'

const CONFIRMED_INVALID_AUTH_CODES = new Set([
  'bad_jwt',
  'invalid_jwt',
  'no_authorization',
  'user_not_found',
  'user_banned',
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
])

export class SessionVerificationUnavailableError extends Error {
  constructor() {
    super('Session verification is temporarily unavailable.')
    this.name = 'SessionVerificationUnavailableError'
  }
}

export function isSessionVerificationUnavailableError(
  error: unknown
): error is SessionVerificationUnavailableError {
  return error instanceof SessionVerificationUnavailableError
}

export function classifyAuthError(error: unknown): Exclude<SessionVerificationStatus, 'valid'> {
  if (isAuthSessionMissingError(error)) return 'invalid'
  if (
    isAuthError(error) &&
    (error.name === 'AuthInvalidJwtError' ||
      (error.code && CONFIRMED_INVALID_AUTH_CODES.has(error.code)))
  ) {
    return 'invalid'
  }
  return 'unavailable'
}

export function classifySessionValidity(
  data: unknown,
  error: unknown
): SessionVerificationStatus {
  if (error) return 'unavailable'
  return data === true ? 'valid' : 'invalid'
}

export function isConfirmedStaffSessionEnded(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown }
  return candidate.code === 'P0001' && candidate.message === 'Staff session has ended'
}
