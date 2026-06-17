export type CatalogItem = {
  id: number
  name_zh: string
  name_ms: string | null
  category: string
  unit: string
}

export function normalizeCatalogSearch(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

export function filterCatalogItems(items: CatalogItem[], query: string): CatalogItem[] {
  const normalizedQuery = normalizeCatalogSearch(query)
  if (!normalizedQuery) return items

  return items.filter((item) => {
    const zh = normalizeCatalogSearch(item.name_zh)
    const ms = normalizeCatalogSearch(item.name_ms)
    return zh.includes(normalizedQuery) || ms.includes(normalizedQuery)
  })
}
