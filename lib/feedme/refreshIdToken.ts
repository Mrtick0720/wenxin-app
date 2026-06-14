// Server-only: mint a fresh Firebase idToken from a long-lived refresh token via
// securetoken.googleapis.com — no browser, no manual hourly paste.
//
// The refresh token comes from FEEDME_REFRESH_TOKEN (.env.local, gitignored).
// The Firebase Web API key is PUBLIC (client-embedded) — not a secret — and is
// overridable via FEEDME_FIREBASE_API_KEY. Tokens are never logged or returned
// to the client; only the resolved idToken string is handed to the server-side
// fetch layer.

const SECURETOKEN_URL = 'https://securetoken.googleapis.com/v1/token'
// Public Firebase Web API key (validated against this project's securetoken).
const DEFAULT_API_KEY = 'AIzaSyA_isPR1-9bX7UmRiJIhsIRNNwdn6DdmW4'
const REFRESH_SKEW_MS = 5 * 60 * 1000 // refresh 5 min before the 1h expiry
// Bound the securetoken call so a stalled endpoint can't hang server render.
// Mirrors FETCH_TIMEOUT_MS in liveDailySales.ts (kept local to avoid a circular
// import, since liveDailySales imports this module).
const MINT_TIMEOUT_MS = 8000

interface TokenState {
  idToken: string
  refreshToken: string
  expiresAt: number
}

// In-process cache so we mint at most once per ~hour, not per request.
let state: TokenState | null = null

function apiKey(): string {
  return process.env.FEEDME_FIREBASE_API_KEY || DEFAULT_API_KEY
}

export function hasRefreshToken(): boolean {
  return Boolean(process.env.FEEDME_REFRESH_TOKEN && process.env.FEEDME_REFRESH_TOKEN.trim())
}

async function mint(refreshToken: string): Promise<TokenState | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MINT_TIMEOUT_MS)
  try {
    const res = await fetch(`${SECURETOKEN_URL}?key=${apiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      id_token?: string
      refresh_token?: string
      expires_in?: string
    }
    if (!json.id_token) return null
    const ttlMs = Number(json.expires_in ?? '3600') * 1000
    return {
      idToken: json.id_token,
      // securetoken may rotate the refresh token — keep the newest.
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: Date.now() + ttlMs,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Returns a valid idToken, refreshing via securetoken only when near expiry.
// Returns null if no refresh token is configured or the refresh fails.
export async function getFeedMeIdToken(): Promise<string | null> {
  // Serve cached idToken while it is still comfortably valid.
  if (state && Date.now() < state.expiresAt - REFRESH_SKEW_MS) {
    return state.idToken
  }
  // Use the rotated refresh token if we have one, else the configured seed.
  const refreshToken = state?.refreshToken || process.env.FEEDME_REFRESH_TOKEN
  if (!refreshToken || !refreshToken.trim()) return null

  const next = await mint(refreshToken)
  if (!next) {
    // Refresh failed — fall back to a still-valid cached token if any.
    return state && Date.now() < state.expiresAt ? state.idToken : null
  }
  state = next
  return state.idToken
}
