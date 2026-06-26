# Purchase Scroll Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Purchase checklist rows from scrolling into blank space while keeping the final row above the fixed add button.

**Architecture:** Keep the carousel container synchronized with the active panel using `ResizeObserver`, clip inactive panels from vertical overflow, reset inherited scroll offsets on tab changes, and use one bottom clearance instead of stacked padding and spacer elements.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node.js regression scripts

---

### Task 1: Add the regression test

**Files:**
- Create: `scripts/test-purchase-scroll-boundary.mjs`
- Modify: `package.json`

- [ ] Assert that the Purchase carousel observes the active panel with `ResizeObserver`.
- [ ] Assert that tab changes reset the Purchase scroll container.
- [ ] Assert that the scroll region has one bottom clearance and no trailing bottom spacer.
- [ ] Run `npm run test:purchase-scroll-boundary` and confirm it fails before implementation.

### Task 2: Synchronize the carousel height

**Files:**
- Modify: `app/purchase/PurchaseClient.tsx`

- [ ] Replace render-time height measurement with an effect scoped to the active tab.
- [ ] Measure immediately and remeasure through `ResizeObserver`.
- [ ] Clip inactive panels so their content cannot expand the active tab's scroll range.
- [ ] Reset `scrollTop` when the active tab changes.
- [ ] Remove the duplicate trailing spacer while retaining the button-safe scroll padding.

### Task 3: Verify the fix

**Files:**
- Test: `scripts/test-purchase-scroll-boundary.mjs`
- Test: `app/purchase/PurchaseClient.tsx`

- [ ] Run `npm run test:purchase-scroll-boundary`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run focused lint on the modified TypeScript file.
- [ ] Verify the maximum scroll position in the local Purchase page.
