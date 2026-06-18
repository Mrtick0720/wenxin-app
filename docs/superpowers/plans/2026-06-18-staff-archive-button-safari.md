# Staff Archive Button Safari Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every eligible staff account consistently shows Archive on iPhone Safari and remove temporary diagnostics.

**Architecture:** Move account-action eligibility into a pure helper shared by rendering and tests. Keep the existing responsive `flex-wrap` action rows, and add a focused regression script that checks action policy and narrow-screen-safe markup.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node.js assertion scripts.

---

### Task 1: Add the failing regression test

**Files:**
- Create: `scripts/test-staff-account-actions.mjs`
- Test: `app/staff/accounts/StaffAccountsClient.tsx`

- [ ] **Step 1: Write the failing test**

Create a Node assertion script that imports `getStaffAccountActionKeys` from `lib/staffAccountActions.ts`, verifies Archive for active and suspended non-owner accounts, verifies no owner actions, checks `flex-wrap` remains in the component, and checks the DEV debug panel is absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/test-staff-account-actions.mjs`

Expected: FAIL because `lib/staffAccountActions.ts` does not exist and the DEV debug panel is still present.

### Task 2: Centralize action visibility and remove diagnostics

**Files:**
- Create: `lib/staffAccountActions.ts`
- Modify: `app/staff/accounts/StaffAccountsClient.tsx`
- Modify: `package.json`

- [ ] **Step 1: Implement the action policy helper**

Export `StaffAccountStatus`, `StaffAccountActionKey`, and `getStaffAccountActionKeys`. Return no actions for owners; return `reset-password`, optional `force-logout`, `suspend`, and `archive` for active staff; return `reactivate` and `archive` for suspended staff; return `restore` for archived staff.

- [ ] **Step 2: Use the helper in the component**

Compute action keys once per account and render each button from the helper result. Preserve the current labels, confirmation behavior, bottom sheets, colors, and wrapping action-row layout.

- [ ] **Step 3: Remove the temporary DEV debug panel**

Delete `isDev` and the yellow diagnostic markup.

- [ ] **Step 4: Add a package test command**

Add `"test:staff-account-actions": "node --experimental-strip-types scripts/test-staff-account-actions.mjs"` to `package.json`.

- [ ] **Step 5: Run the focused test**

Run: `npm run test:staff-account-actions`

Expected: PASS with `staff account action tests passed`.

### Task 3: Verify the completed fix

**Files:**
- Verify: `app/staff/accounts/StaffAccountsClient.tsx`
- Verify: `lib/staffAccountActions.ts`
- Verify: `scripts/test-staff-account-actions.mjs`

- [ ] **Step 1: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 2: Run focused lint**

Run: `npx eslint app/staff/accounts/StaffAccountsClient.tsx lib/staffAccountActions.ts scripts/test-staff-account-actions.mjs`

Expected: exit code 0.

- [ ] **Step 3: Verify the live page**

Open `/staff/accounts` at an iPhone-sized viewport and confirm active non-owner cards show Reset password, Suspend, and Archive without clipping; confirm the yellow debug panel is gone.

