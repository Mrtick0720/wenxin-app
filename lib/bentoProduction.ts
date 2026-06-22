export type ProductionLine = {
  key: string
  label: string
  compartment_a: string | null
  compartment_b: string | null
  compartment_c: string | null
  qty: number
}

export type ProductionOrder = {
  id: number
  customer_name?: string
  quantity?: number
  status?: string
  bento_items?: string | null
  menu_type?: string | null
  items?: string | null
  compartment_a?: string | null
  compartment_b?: string | null
  compartment_c?: string | null
}

type StructuredMenu = {
  version?: number
  variants?: { id: number; qty: number }[]
  combos?: unknown[]
  production_lines?: ProductionLine[]
  completed_line_keys?: string[]
}

export type ProductionCard = ProductionLine & {
  totalQty: number
  done: boolean
  customers: {
    orderId: number
    customerName: string
    qty: number
    lineKey: string
  }[]
}

function parseMenu(raw: string | null | undefined): StructuredMenu {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as StructuredMenu : {}
  } catch {
    return {}
  }
}

function normalizeLine(line: ProductionLine): ProductionLine {
  return {
    key: String(line.key),
    label: String(line.label || 'Bento'),
    compartment_a: line.compartment_a || null,
    compartment_b: line.compartment_b || null,
    compartment_c: line.compartment_c || null,
    qty: Math.max(0, Number(line.qty) || 0),
  }
}

export function buildStructuredMenu({
  variants,
  combos,
  productionLines,
  completedLineKeys = [],
}: {
  variants: { id: number; qty: number }[]
  combos: unknown[]
  productionLines: ProductionLine[]
  completedLineKeys?: string[]
}) {
  const lineMap = new Map<string, ProductionLine>()
  for (const rawLine of productionLines) {
    const line = normalizeLine(rawLine)
    if (line.qty <= 0) continue
    const existing = lineMap.get(line.key)
    if (existing) existing.qty += line.qty
    else lineMap.set(line.key, line)
  }
  const lines = Array.from(lineMap.values())
  const validKeys = new Set(lines.map(line => line.key))
  return JSON.stringify({
    version: 2,
    variants,
    combos,
    production_lines: lines,
    completed_line_keys: completedLineKeys.filter(key => validKeys.has(key)),
  })
}

export function getOrderProductionLines(order: ProductionOrder): ProductionLine[] {
  const parsed = parseMenu(order.bento_items)
  if (Array.isArray(parsed.production_lines) && parsed.production_lines.length > 0) {
    return parsed.production_lines.map(normalizeLine).filter(line => line.qty > 0)
  }

  const oldSelections = [
    ...(parsed.variants ?? []).map(variant => ({ key: `variant:${variant.id}`, qty: variant.qty })),
    ...((parsed.combos ?? []) as Array<{ qty?: number }>).map((combo, index) => ({ key: `custom:legacy:${index}`, qty: combo.qty ?? 1 })),
  ]
  if (oldSelections.length > 1) {
    const labels = (order.items || '').split(',').map(part =>
      part.replace(/\s+x\d+\s*$/i, '').trim()
    )
    return oldSelections.map((selection, index) => ({
      key: selection.key,
      label: labels[index] || `Bento ${index + 1}`,
      compartment_a: null,
      compartment_b: null,
      compartment_c: null,
      qty: Math.max(1, Number(selection.qty) || 1),
    }))
  }

  const label = order.menu_type?.trim() || order.items?.trim() || order.compartment_a?.trim() || 'Bento'
  const identity = [
    label,
    order.compartment_a || '',
    order.compartment_b || '',
    order.compartment_c || '',
  ].join('|').toLowerCase()

  return [{
    key: `legacy:${identity}`,
    label,
    compartment_a: order.compartment_a || null,
    compartment_b: order.compartment_b || null,
    compartment_c: order.compartment_c || null,
    qty: Math.max(1, order.quantity ?? 1),
  }]
}

export function getCompletedProductionLineKeys(order: ProductionOrder) {
  const parsed = parseMenu(order.bento_items)
  if (Array.isArray(parsed.completed_line_keys)) return parsed.completed_line_keys.map(String)
  return order.status === 'completed' ? getOrderProductionLines(order).map(line => line.key) : []
}

export function aggregateProductionCards(orders: ProductionOrder[]): ProductionCard[] {
  const cards = new Map<string, ProductionCard>()

  for (const order of orders) {
    const completed = new Set(getCompletedProductionLineKeys(order))
    for (const line of getOrderProductionLines(order)) {
      let card = cards.get(line.key)
      if (!card) {
        card = {
          ...line,
          qty: line.qty,
          totalQty: 0,
          done: true,
          customers: [],
        }
        cards.set(line.key, card)
      }
      card.totalQty += line.qty
      card.done = card.done && completed.has(line.key)
      card.customers.push({
        orderId: order.id,
        customerName: order.customer_name || 'Customer',
        qty: line.qty,
        lineKey: line.key,
      })
    }
  }

  return Array.from(cards.values())
}

export function updateProductionLineCompletion(
  raw: string | null | undefined,
  lineKey: string,
  done: boolean,
  order: ProductionOrder,
) {
  const parsed = parseMenu(raw)
  const lines = getOrderProductionLines(order)
  const completed = new Set(
    Array.isArray(parsed.completed_line_keys)
      ? parsed.completed_line_keys.map(String)
      : order.status === 'completed'
        ? lines.map(line => line.key)
        : [],
  )

  if (done) completed.add(lineKey)
  else completed.delete(lineKey)

  const allKeys = lines.map(line => line.key)
  const orderCompleted = allKeys.length > 0 && allKeys.every(key => completed.has(key))
  const next = {
    ...parsed,
    version: 2,
    production_lines: lines,
    completed_line_keys: Array.from(completed).filter(key => allKeys.includes(key)),
  }

  return {
    bentoItems: JSON.stringify(next),
    orderCompleted,
  }
}
