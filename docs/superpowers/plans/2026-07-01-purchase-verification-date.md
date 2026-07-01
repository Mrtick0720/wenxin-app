# Purchase Verification Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign a carried-over purchase to the Kota Kinabalu business date on which it is accepted in To Verify.

**Architecture:** Put the record projection in a small pure module so date behaviour is testable without Supabase. The server action computes `businessToday()`, writes that date atomically with the verified status, and returns the same projected record used by the optimistic UI.

**Tech Stack:** Next.js server actions, TypeScript, Supabase, Node/tsx script tests

---

### Task 1: Add the cross-day regression test

**Files:**
- Create: `lib/purchaseLedger/verification.ts`
- Modify: `scripts/test-purchase-ledger.mjs`

- [ ] **Step 1: Write a failing test**

Import `projectAcceptedVerification` and assert that projecting a record dated `2026-06-29` with business date `2026-07-01` returns `date: '2026-07-01'`, preserves `created_at`, and applies the verification audit fields.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm run test:purchase-ledger`. Expected: failure because `lib/purchaseLedger/verification.ts` does not exist.

- [ ] **Step 3: Add the minimal pure projection**

Create `projectAcceptedVerification(record, { businessDate, verifiedByName, verifiedAt, receivedQuantity })`, returning the record with `date`, `status`, `verified_by_name`, `verified_at`, and `received_quantity` updated.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npm run test:purchase-ledger`. Expected: all assertions pass.

### Task 2: Use the business date in the server action

**Files:**
- Modify: `app/purchase/verification-actions.ts`

- [ ] **Step 1: Compute the restaurant business date**

Import and call `businessToday()` inside `acceptVerificationAction`.

- [ ] **Step 2: Persist the date atomically**

Add `date: businessDate` to the guarded Supabase update alongside `status: 'verified'`.

- [ ] **Step 3: Return the authoritative projected record**

Use `projectAcceptedVerification` so the action response carries the new date and matches the database mutation.

- [ ] **Step 4: Run verification**

Run `npm run test:purchase-ledger` and `npx tsc --noEmit`. Expected: both exit successfully with no failures.
