import { pinyin } from 'pinyin-pro'

export type CatalogItem = {
  id: number
  name_zh: string
  name_ms: string | null
  category: string
  unit: string
}

export type CatalogDisplayMode = 'default' | 'latin'

export function normalizeCatalogSearch(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

export function resolveCatalogDisplayName(
  storedName: string,
  catalog: CatalogItem[],
  mode: CatalogDisplayMode,
): string {
  if (mode === 'default') return storedName

  const target = normalizeCatalogSearch(storedName)
  const match = catalog.find(
    (item) =>
      normalizeCatalogSearch(item.name_zh) === target ||
      normalizeCatalogSearch(item.name_ms) === target,
  )

  return match?.name_ms?.trim() || 'Unknown item'
}

const HAN_QUERY = /\p{Script=Han}/u
const LATIN_QUERY = /[a-z]/i

function contiguousCombinations(parts: string[]): string[] {
  const combinations: string[] = []
  for (let start = 0; start < parts.length; start += 1) {
    let joined = ''
    for (let end = start; end < parts.length; end += 1) {
      joined += parts[end]
      combinations.push(joined)
    }
  }
  return combinations
}

function latinSearchValues(item: CatalogItem): string[] {
  const pinyinParts = pinyin(item.name_zh, {
    toneType: 'none',
    type: 'array',
  }).map(normalizeCatalogSearch)
  const initials = pinyinParts.map((part) => part[0] ?? '').join('')
  const malayParts = (item.name_ms ?? '')
    .split(/[\s/(),.-]+/)
    .map(normalizeCatalogSearch)
    .filter(Boolean)

  return Array.from(new Set([
    normalizeCatalogSearch(item.name_ms),
    ...contiguousCombinations(malayParts),
    pinyinParts.join(''),
    ...contiguousCombinations(pinyinParts),
    initials,
  ].filter(Boolean)))
}

function damerauLevenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = a[row - 1] === b[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost,
      )

      if (
        row > 1 &&
        col > 1 &&
        a[row - 1] === b[col - 2] &&
        a[row - 2] === b[col - 1]
      ) {
        matrix[row][col] = Math.min(
          matrix[row][col],
          matrix[row - 2][col - 2] + substitutionCost,
        )
      }
    }
  }

  return matrix[a.length][b.length]
}

function latinMatchScore(values: string[], query: string): number | null {
  let bestScore = Number.POSITIVE_INFINITY

  for (const value of values) {
    if (value === query) bestScore = Math.min(bestScore, 0)
    else if (value.startsWith(query)) bestScore = Math.min(bestScore, 10)
    else {
      const substringIndex = value.indexOf(query)
      if (substringIndex >= 0) bestScore = Math.min(bestScore, 20 + substringIndex)
    }
  }

  if (bestScore < Number.POSITIVE_INFINITY || query.length < 4) {
    return bestScore < Number.POSITIVE_INFINITY ? bestScore : null
  }

  const maxDistance = query.length <= 5 ? 1 : query.length <= 10 ? 2 : 3
  for (const value of values) {
    if (Math.abs(value.length - query.length) > maxDistance) continue
    const distance = damerauLevenshtein(value, query)
    if (distance <= maxDistance) {
      bestScore = Math.min(bestScore, 30 + distance)
    }
  }

  return bestScore < Number.POSITIVE_INFINITY ? bestScore : null
}

export function filterCatalogItems(items: CatalogItem[], query: string): CatalogItem[] {
  const normalizedQuery = normalizeCatalogSearch(query)
  if (!normalizedQuery) return items

  if (HAN_QUERY.test(normalizedQuery) || !LATIN_QUERY.test(normalizedQuery)) {
    return items.filter((item) => {
      const zh = normalizeCatalogSearch(item.name_zh)
      const ms = normalizeCatalogSearch(item.name_ms)
      return zh.includes(normalizedQuery) || ms.includes(normalizedQuery)
    })
  }

  return items
    .map((item, index) => ({
      item,
      index,
      score: latinMatchScore(latinSearchValues(item), normalizedQuery),
    }))
    .filter((result): result is typeof result & { score: number } => result.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ item }) => item)
}
