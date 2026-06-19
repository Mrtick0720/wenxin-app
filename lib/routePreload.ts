export type RouteLoader = () => Promise<unknown>

export function preloadRouteLoaders(loaders: RouteLoader[]) {
  for (const load of loaders) {
    void load().catch(() => undefined)
  }
}
