# Production Meal Cards and Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate Production Sheet by meal, persist per-meal completion, and refresh reliably after order edits.

**Architecture:** Store meal snapshots and completed line keys in the existing `bento_items` JSON text. A pure helper parses legacy/new orders, aggregates meal cards, and computes per-order completion; Production uses it for rendering and updates.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase

---

### Task 1: Production data model

**Files:**
- Create: `lib/bentoProduction.ts`
- Create: `scripts/test-bento-production.mjs`

- [ ] Test multi-meal parsing, cross-customer aggregation, legacy fallback, and completion updates.
- [ ] Implement the pure production helpers.
- [ ] Run the focused test.

### Task 2: Order snapshots

**Files:**
- Modify: `app/bento/new/page.tsx`
- Modify: `app/bento/orders/[id]/edit/page.tsx`
- Modify: `app/bento/orders/actions.ts`

- [ ] Write `production_lines` snapshots for variants and custom combinations.
- [ ] Preserve completed keys that still exist after editing.
- [ ] Stop the server action from overwriting a multi-meal payload with the first variant.
- [ ] Broadcast both old and new dates after edit.

### Task 3: Production meal cards and refresh

**Files:**
- Modify: `app/bento/production/page.tsx`

- [ ] Aggregate cards by meal within delivery/ready-time groups.
- [ ] Render total quantity and customer quantity breakdown.
- [ ] Toggle one meal across all contributing orders.
- [ ] Mark an order completed only when all its lines are done.
- [ ] Reload on realtime, local event, focus, and visibility.

### Task 4: Verification

- [ ] Run production tests.
- [ ] Run TypeScript.
- [ ] Run existing Bento interaction tests.
- [ ] Run diff checks.
