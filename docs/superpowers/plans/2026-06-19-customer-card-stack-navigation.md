# Customer Card Stack Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make customer cards open their customer detail page through the existing NavigationStack.

**Architecture:** `CustomersClient` will push a lazily loaded detail component into the stack instead of changing only the Next.js URL. `CustomerDetailPage` will accept an optional `customerId` prop while retaining `useParams()` as the fallback for direct URL access.

**Tech Stack:** Next.js 16, React 19, TypeScript, custom NavigationStack.

---

### Task 1: Add stack-compatible customer detail input

**Files:**
- Modify: `app/bento/customers/[id]/page.tsx`

- [ ] Add an optional `customerId: number | string` prop.
- [ ] Prefer the supplied prop and fall back to the dynamic route parameter.
- [ ] Keep all existing data loading and rendering behavior unchanged.

### Task 2: Open customer cards through NavigationStack

**Files:**
- Modify: `app/bento/customers/CustomersClient.tsx`

- [ ] Lazily import `CustomerDetailPage`.
- [ ] Read `push` from `useNavigation()`.
- [ ] Replace the customer-card `router.push()` call with a stack `push()` containing the selected customer ID.
- [ ] Preserve the card UI and direct-route behavior.

### Task 3: Verify

**Files:**
- Test: `app/bento/customers/CustomersClient.tsx`
- Test: `app/bento/customers/[id]/page.tsx`

- [ ] Run a static regression check proving cards use stack navigation.
- [ ] Run ESLint on both files.
- [ ] Run `git diff --check`.
