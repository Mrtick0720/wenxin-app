# Purchase Conservative Loading Optimization

## Goal

Reduce the time from tapping Purchase on Home to seeing usable Purchase content, without changing the page layout, business behavior, database schema, realtime behavior, or history-loading model.

## Scope

This first optimization pass is intentionally conservative:

- Start the Purchase content and hero requests concurrently.
- Remove the duplicate pending-verification request during a cold bootstrap.
- Keep a standalone pending-verification refresh only when cached Purchase data lets the main bootstrap request be skipped.
- Load the purchase catalog only when the user first opens an add-item interface that needs it.
- Preserve the existing module cache, loading skeletons, realtime subscriptions, eight-second synchronization, retries, and server-side authorization.

The following are explicitly out of scope:

- Changing the Purchase UI or navigation animation.
- Loading only today's records.
- Deferring purchase history.
- Adding database indexes or migrations.
- Replacing the current server actions with a new RPC.
- Refactoring the large Purchase component beyond the changes needed for this optimization.

## Current Problem

On a cold stack-navigation entry, `PurchaseClient` waits for
`fetchPurchaseContentAction()` before starting `fetchPurchaseHeroAction()`.
Despite the nearby comment describing parallel loading, the two requests are
sequential.

The content bootstrap already returns pending-verification records, but a
separate mount effect requests the same records again. The catalog also loads on
every entry even when the user never opens an add-item form.

Each server action performs its own role and session verification, so removing
these unnecessary action calls reduces both HTTP overhead and repeated Supabase
authentication queries.

## Design

### Concurrent bootstrap

When no fresh cache is available, start the content and hero server actions
together. Process each result independently so content can become usable without
waiting for KPI data, and KPI data can render without waiting for the larger
content response.

An error in one request must not discard a successful result from the other.
Existing section-specific loading and error states remain in use.

### Pending-verification refresh

During a cold bootstrap, pending-verification records come exclusively from the
combined content response.

When a fresh module cache causes the combined bootstrap to be skipped, perform
one standalone pending-verification refresh in the background. This preserves
the existing near-realtime correctness of the verification tab without
duplicating the cold-start query.

Realtime subscriptions and the existing periodic refresh remain unchanged.

### Lazy catalog loading

The catalog begins in an unloaded state. A shared `ensureCatalogLoaded`
operation starts the catalog request at most once and is called immediately
before opening either Purchase add-item interface that needs catalog data.

The add interface may open immediately and continue showing its existing catalog
loading state while the request finishes. Failures continue to use the existing
catalog error state.

### Cache behavior

The existing four-minute Purchase module cache remains authoritative for initial
rendering. Successful content and hero responses update their current cache
fields independently. No persisted browser storage is added.

## Testing

Extend the Purchase progressive-loading source test to prove:

- Content and hero actions are started before either result is awaited.
- A cold bootstrap does not also run the standalone pending-verification fetch.
- A cache-hit path can still refresh pending verification.
- Catalog loading is triggered from add-item opening rather than an unconditional
  mount effect.

Run the focused loading regression test, Purchase ledger tests, and TypeScript
type checking. A production build may still report unrelated pre-existing build
issues; any such failure must be reported separately and not presented as a
Purchase regression.

## Success Criteria

- Cold Home-to-Purchase entry starts content and KPI work concurrently.
- Cold entry performs no duplicate pending-verification server action.
- Catalog is not requested unless an add-item workflow is opened.
- Existing Purchase loading tests and TypeScript checks pass.
- Purchase navigation, cache, realtime updates, refresh, and user-visible
  behavior remain unchanged.
