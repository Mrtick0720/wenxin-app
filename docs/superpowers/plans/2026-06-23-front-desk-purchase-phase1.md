# Front Desk Purchase Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow front desk staff to safely open Purchase, submit To Buy requests, read role-safe To Verify/Received data, and accept/reject verification without receiving cost privileges or purchase-execution powers.

**Architecture:** Align route, role, and server-action access lists; make repository and verification queries choose columns by role; add a narrow front-desk RLS read policy; keep execution, cancel, delete, export, and cost capabilities restricted.

**Tech Stack:** Next.js 16, TypeScript, Supabase PostgreSQL RLS, Node.js regression scripts

---

### Task 1: Lock the permission boundary with failing tests

**Files:**
- Modify: `scripts/test-auth-permissions.mjs`
- Modify: `scripts/test-permission-layer.mjs`
- Modify: `scripts/test-purchase-ledger.mjs`
- Create: `scripts/test-front-desk-purchase-phase1.mjs`
- Modify: `package.json`

- [ ] Assert front desk can access and navigate to `/purchase`.
- [ ] Assert front desk has `VIEW_PURCHASE`, but not direct-ledger `EDIT_PURCHASE`, cost, delete, export, or legacy `APPROVE_PURCHASE`.
- [ ] Assert Purchase and checklist read/init action role lists include front desk while completion/cancel actions remain restricted.
- [ ] Assert staff purchase queries use safe columns and the Phase 1 migration grants only narrow SELECT access.
- [ ] Run the focused tests and confirm they fail for the missing Phase 1 behavior.

### Task 2: Align route and application permissions

**Files:**
- Modify: `lib/auth/permissions.ts`
- Modify: `lib/auth/rolePermissions.ts`
- Modify: `app/purchase/actions.ts`
- Modify: `app/purchase/checklist-actions.ts`

- [ ] Add front desk to Purchase route and navigation visibility.
- [ ] Grant only `VIEW_PURCHASE`; checklist request submission is authorized independently.
- [ ] Add front desk to common Purchase and checklist read/init/request role lists.
- [ ] Leave checklist completion, cancel, delete, export, and cost permissions unchanged.

### Task 3: Enforce role-safe Purchase data

**Files:**
- Modify: `lib/purchaseLedger/repository.ts`
- Modify: `lib/purchaseLedger/service.ts`
- Modify: `app/purchase/actions.ts`
- Modify: `app/purchase/checklist-actions.ts`
- Modify: `app/purchase/verification-actions.ts`
- Modify: `app/purchase/PendingVerificationSection.tsx`
- Modify: `app/purchase/PurchaseClient.tsx`

- [ ] Centralize owner/manager versus staff-safe Purchase record columns.
- [ ] Pass the caller role into pending-verification reads.
- [ ] Return staff-safe columns after front desk/kitchen verification.
- [ ] Omit supplier from front desk/kitchen checklist reads and action responses.
- [ ] Hide cancel/return-to-To-Buy from kitchen and front desk while preserving Accept/Reject.

### Task 4: Add the narrow RLS migration

**Files:**
- Create: `supabase/migrations/20260623_front_desk_purchase_phase1.sql`

- [ ] Add a front-desk SELECT policy for pending-verification rows and today's Received rows.
- [ ] Preserve existing insert/update/delete policies.
- [ ] Document that application queries still enforce column hiding because RLS is row-based.

### Task 5: Verify

**Files:**
- Test all files above

- [ ] Run the Phase 1 regression test.
- [ ] Run auth, permission-layer, purchase-ledger, and Purchase loading tests.
- [ ] Run TypeScript checking and diff validation.
- [ ] Report the SQL migration as requiring manual application if migrations are not automatically deployed.
