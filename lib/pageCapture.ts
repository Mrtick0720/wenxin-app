// Stores a cloned snapshot of the home page DOM for use as back-navigation background

let snapshot: HTMLElement | null = null

export function captureSnapshot(el: HTMLElement) {
  snapshot = el.cloneNode(true) as HTMLElement
}

export function getSnapshot(): HTMLElement | null {
  return snapshot ? snapshot.cloneNode(true) as HTMLElement : null
}
