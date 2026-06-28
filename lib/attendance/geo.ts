// ── Attendance geofencing ──
// GPS-based location check so staff can only clock in / out while physically
// at the restaurant. WiFi SSID verification is deliberately NOT used: this is a
// PWA and iOS Safari cannot reliably read the connected SSID.

// Restaurant coordinates. Constants for now — later these move into
// restaurant_settings so the owner can configure them from the app.
//
// 文心砂锅 (Wenxin Claypot), Kota Kinabalu.
export const STORE_LOCATION = {
  latitude: 5.992101938840452,
  longitude: 116.08154869754013,
  /** Max distance from the restaurant (metres) allowed to clock in/out. */
  allowedRadius: 100,
}

export type Coords = {
  latitude: number
  longitude: number
  accuracy: number
}

/**
 * Great-circle distance between two lat/lng points in METRES (Haversine).
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000 // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Distance (metres) from the restaurant to the given coordinates. */
export function distanceToStore(latitude: number, longitude: number): number {
  return haversineDistance(
    latitude, longitude,
    STORE_LOCATION.latitude, STORE_LOCATION.longitude,
  )
}

/** Human-readable distance: "18 m" under 1 km, "1.3 km" above. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}

export type GeoError = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'

/**
 * One-shot high-accuracy position read, wrapped in a Promise. Rejects with a
 * GeoError string so callers can branch on permission vs. signal failures.
 *
 * Note: browser geolocation only works in a SECURE context (HTTPS or
 * localhost). Over a plain-HTTP LAN address (e.g. the dev server on a phone)
 * the API is blocked — we surface that as 'insecure' so the UI can explain it.
 */
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject('unsupported' as GeoError)
      return
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject('insecure' as GeoError)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => {
        if (err.code === err.PERMISSION_DENIED) reject('denied' as GeoError)
        else if (err.code === err.TIMEOUT) reject('timeout' as GeoError)
        else reject('unavailable' as GeoError)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}
