# Wenxin Permission Layer — Phase 0 Implementation Checklist

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** [permission-layer-design.md](permission-layer-design.md) (approved)
**Next Phase:** Phase 0.5 — Apply permission layer to new modules

---

## A. Phase 0 Scope

### A.1 Objective

Create the permission infrastructure — constants, mappings, and helper functions — without changing a single line of existing behavior. No route access changes. No UI changes. No database changes.

### A.2 In Scope

| # | Deliverable | File | Description |
|---|------------|------|-------------|
| 1 | Permission key constants | `lib/auth/permissionKeys.ts` | 51 `PERMISSION` string constants with colon-delimited values |
| 2 | Role-permission mappings | `lib/auth/rolePermissions.ts` | `ROLE_PERMISSIONS` object mapping each role to its permission array |
| 3 | Permission check functions | `lib/auth/permissionCheck.ts` | `hasPermission()`, `hasAllPermissions()`, `hasAnyPermission()`, `getPermissionsForRole()` |
| 4 | Permission-route map | `lib/auth/permissionRouteMap.ts` | `PERMISSION_ROUTE_MAP` mapping permissions to route prefixes |
| 5 | Delivery role type | `lib/auth/types.ts` | Add `'delivery'` to `STAFF_ROLES` constant |
| 6 | Permission validation test | `scripts/test-permission-layer.mjs` | Pure-function tests: hasPermission, role mapping, permission key validity |
| 7 | Package script | `package.json` | Add `"test:permission-layer"` script |

### A.3 Explicitly Out of Scope

| Out of Scope | Why |
|-------------|-----|
| Changing `ROUTE_RULES` array | Phase 0.5 |
| Changing `canAccessPath()` logic | Phase 0.5 |
| Changing `getHomeVisibility()` | Phase 0.5 |
| Changing `getNavigationItems()` | Phase 0.5 |
| Adding `requirePermission()` to `currentStaff.ts` | Phase 0.5 |
| Adding `usePermission()` to `StaffProvider.tsx` | Phase 0.5 |
| Modifying `proxy.ts` | Phase 0.5 |
| Changing any server component or server action | Phase 0.5 |
| Database migrations | Phase 0.5 |
| RLS policy changes | Never (RLS stays role-based) |
| Creating `delivery` user accounts | Future (Phase 0.5+) |

### A.4 Deliverable Summary

```
Phase 0 deliverables:
  NEW: lib/auth/permissionKeys.ts         (~120 lines)
  NEW: lib/auth/rolePermissions.ts        (~160 lines)
  NEW: lib/auth/permissionCheck.ts        (~40 lines)
  NEW: lib/auth/permissionRouteMap.ts     (~70 lines)
  NEW: scripts/test-permission-layer.mjs  (~150 lines)
  EDIT: lib/auth/types.ts                 (+1 line: add 'delivery')
  EDIT: package.json                      (+1 line: test script)
```

---

## B. File Impact Analysis

### B.1 `lib/auth/permissionKeys.ts` — NEW

**Purpose:** Single source of truth for all permission constants.

**Contents:**
- `PERMISSION` object with 51 string constants
- `PermissionKey` type (union of all values)
- Organized by module: Home, Bento, Purchase, Inventory, Finance, Reports, Dine-in, Reservations, Complaints, Incidents, Tasks, Staff, Attendance, Checklist, Suppliers, Assets, Cashier, Profile, Sensitive, Admin

**Risk Level:** Zero. New file. Nothing imports it.

**Validation:**
- TypeScript compiles without errors
- All 51 keys follow the `module:resource:action` naming convention
- No duplicate key values
- Every approved module has at minimum `VIEW_` and where applicable `EDIT_`

### B.2 `lib/auth/rolePermissions.ts` — NEW

**Purpose:** Maps each role to the set of permissions it holds.

**Contents:**
- `ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]>`
- Owner: all permissions (spread operator)
- Manager: explicitly listed permissions
- Kitchen: explicitly listed permissions
- Front Desk: explicitly listed permissions
- Delivery: minimal permission set

**Risk Level:** Zero. New file. Nothing imports it.

**Validation:**
- Every role has at least one permission
- Owner permissions array contains all 51 keys (verified programmatically)
- No role references a key not in `PERMISSION`
- Delivery role permissions are a strict subset of Front Desk permissions (delivery is the most restricted role)

### B.3 `lib/auth/permissionCheck.ts` — NEW

**Purpose:** Pure functions for permission checking.

**Contents:**
- `hasPermission(role, permission)` → boolean
- `hasAllPermissions(role, permissions)` → boolean
- `hasAnyPermission(role, permissions)` → boolean
- `getPermissionsForRole(role)` → PermissionKey[]

**Risk Level:** Zero. New file. Nothing imports it.

**Validation:**
- Pure functions — no side effects, no database calls, no network requests
- `hasPermission` returns false for unknown roles
- `hasPermission` returns false for unknown permissions
- `hasAllPermissions` returns true only when ALL permissions are held
- `hasAnyPermission` returns true when ANY permission is held

### B.4 `lib/auth/permissionRouteMap.ts` — NEW

**Purpose:** Maps each permission to the route prefixes it grants access to. Used in Phase 0.5+ by `canAccessPath()`.

**Contents:**
- `PERMISSION_ROUTE_MAP: Partial<Record<PermissionKey, string[]>>`
- Each entry maps one permission to one or more route prefixes

**Risk Level:** Zero. New file. Nothing imports it in Phase 0.

**Validation:**
- Every route prefix starts with `/`
- Every permission key referenced exists in `PERMISSION`
- No route prefix overlaps incorrectly (e.g., `/bento` and `/bento/production` are separate entries)

### B.5 `lib/auth/types.ts` — EDIT

**Purpose:** Staff role type definitions.

**Current state:**
```typescript
export const STAFF_ROLES = ['owner', 'manager', 'kitchen', 'front_desk'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
```

**Planned change:**
```typescript
export const STAFF_ROLES = ['owner', 'manager', 'kitchen', 'front_desk', 'delivery'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]
```

**Risk Level:** Low. Adding a value to a const array. TypeScript will flag any exhaustive switch statements that don't handle the new role — this is a feature, not a bug (it tells us where the new role needs handling).

**Impact analysis:**
- `StaffRole` type now includes `'delivery'`
- `isStaffRole('delivery')` returns true
- `STAFF_ROLES.includes('delivery')` returns true
- `ROUTE_RULES` entries that use `ALL_ROLES` will NOT include delivery (ALL_ROLES is a separate object, not derived from STAFF_ROLES)
- `BOTTOM_NAV_ITEMS` entries that use `ALL_ROLES` will NOT include delivery
- No existing user has the `delivery` role — no login behavior changes

**Validation:**
- `typeof STAFF_ROLES` shows 5 elements
- TypeScript compiles without errors
- No existing tests break
- `ROUTE_RULES` and `BOTTOM_NAV_ITEMS` do not accidentally include delivery (they use explicit `RoleMap` objects, not `STAFF_ROLES`)

### B.6 `scripts/test-permission-layer.mjs` — NEW

**Purpose:** Pure-function tests for the permission layer. No Supabase, no database, no browser.

**Contents:**
- Test: all 51 permission keys are unique
- Test: every permission key follows naming convention
- Test: owner has all permissions
- Test: manager has correct permission set (spot-check 5 critical permissions)
- Test: kitchen has correct permission set (spot-check)
- Test: front_desk has correct permission set (spot-check)
- Test: delivery has correct (minimal) permission set
- Test: `hasPermission` returns true for valid role + permission
- Test: `hasPermission` returns false for invalid role
- Test: `hasPermission` returns false for valid role + missing permission
- Test: `hasAllPermissions` returns true when all held
- Test: `hasAllPermissions` returns false when one is missing
- Test: `hasAnyPermission` returns true when any held
- Test: `hasAnyPermission` returns false when none held
- Test: `PERMISSION_ROUTE_MAP` keys are all valid permission keys
- Test: `PERMISSION_ROUTE_MAP` values are all valid route prefixes

**Risk Level:** Zero. New file. Only tests the new Phase 0 files.

**Validation:**
- Run: `node scripts/test-permission-layer.mjs`
- Expected: all assertions pass
- Expected: zero output = pass (or structured pass/fail output)

### B.7 `package.json` — EDIT

**Purpose:** Add test script.

**Planned change:**
```json
"test:permission-layer": "node scripts/test-permission-layer.mjs"
```

**Risk Level:** Zero. Adding a script entry. No existing scripts are modified.

---

## C. Validation Plan

### C.1 Automated Validation

```bash
# 1. Pure-function permission tests
npm run test:permission-layer

# 2. TypeScript compilation — no new errors
npx tsc --noEmit

# 3. Existing auth permission tests still pass (Phase 0 does not change permissions.ts logic)
npm run test:auth-permissions

# 4. Existing auth audit tests still pass
npm run test:auth-audit

# 5. Existing subscription schedule tests still pass
npm run test:subscription-schedule

# 6. Existing bento interaction tests still pass
npm run test:bento-interactions

# 7. Production build succeeds
npm run build -- --webpack
```

### C.2 Manual Validation — Route Access

For each role, verify that every route accessible before Phase 0 remains accessible:

| # | Test | Owner | Manager | Kitchen | Front Desk |
|---|------|:-----:|:-------:|:-------:|:----------:|
| 1 | `GET /` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 2 | `GET /bento` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 3 | `GET /bento/production` | ✅ 200 | ✅ 200 | ✅ 200 | ❌ redirect |
| 4 | `GET /bento/customers` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 5 | `GET /bento/weekly-menu` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 6 | `GET /bento/unpaid` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 7 | `GET /bento/new` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 8 | `GET /purchase` | ✅ 200 | ✅ 200 | ✅ 200 | ❌ redirect |
| 9 | `GET /inventory` | ✅ 200 | ✅ 200 | ✅ 200 | ❌ redirect |
| 10 | `GET /finance` | ✅ 200 | ❌ redirect | ❌ redirect | ❌ redirect |
| 11 | `GET /reports` | ✅ 200 | ✅ 200 | ❌ redirect | ❌ redirect |
| 12 | `GET /dine-in` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 13 | `GET /reservations` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 14 | `GET /complaints` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 15 | `GET /incidents` | ✅ 200 | ✅ 200 | ❌ redirect | ✅ 200 |
| 16 | `GET /tasks` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| 17 | `GET /staff` | ✅ 200 | ✅ 200 | ❌ redirect | ❌ redirect |
| 18 | `GET /staff/accounts` | ✅ 200 | ❌ redirect | ❌ redirect | ❌ redirect |
| 19 | `GET /staff/activity` | ✅ 200 | ❌ redirect | ❌ redirect | ❌ redirect |
| 20 | `GET /profile` | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |

**Method:** Open the app in a browser, sign in as each role, navigate to each route. Or use a script that curls each route with role-specific cookies and asserts the HTTP status.

### C.3 Manual Validation — No Visual Changes

For each role, confirm:
- Home dashboard looks identical to pre-Phase 0
- Quick Access grid is unchanged (no new cards, no missing cards)
- BottomNav tabs are unchanged
- Revenue visibility is unchanged (Owner/Manager see RM; Kitchen/Front Desk do not)
- Bento view is unchanged (Kitchen sees limited view; Front Desk sees full view without Production)
- No new UI elements, no missing UI elements
- No console errors or warnings related to the new files

### C.4 Cross-Role Behavior Verification

| # | Test | Expected |
|---|------|----------|
| 1 | Kitchen opens Bento — sees orders, production, weekly menu | No Customers, No Unpaid, No New Order links |
| 2 | Kitchen opens Bento order — can mark completed, cannot see customer payment info | Fulfillment only |
| 3 | Front Desk opens Bento — sees orders, customers, payments | No Production link |
| 4 | Manager opens Finance | Redirected to /access-denied |
| 5 | Kitchen opens Finance | Redirected to /access-denied |
| 6 | Front Desk opens Staff page | Redirected to /access-denied |
| 7 | All roles can access Tasks | ✅ |
| 8 | All roles can access Profile | ✅ |

---

## D. Testing Checklist

### D.1 Pre-Implementation

- [ ] Read the approved [permission-layer-design.md](permission-layer-design.md) in full
- [ ] Confirm all 51 permission keys match the approved permission matrix (§E)
- [ ] Confirm role-permission assignments match the approved matrix
- [ ] Confirm `PERMISSION_ROUTE_MAP` entries match the approved module routes
- [ ] Verify `delivery` role permissions against the approved matrix
- [ ] Branch from `main` into a feature branch: `feat/permission-phase0`

### D.2 Implementation

- [ ] Create `lib/auth/permissionKeys.ts`
- [ ] Create `lib/auth/rolePermissions.ts`
- [ ] Create `lib/auth/permissionCheck.ts`
- [ ] Create `lib/auth/permissionRouteMap.ts`
- [ ] Edit `lib/auth/types.ts` — add `'delivery'` to `STAFF_ROLES`
- [ ] Create `scripts/test-permission-layer.mjs`
- [ ] Edit `package.json` — add `"test:permission-layer"` script
- [ ] Run `npm run test:permission-layer` — all assertions pass
- [ ] Run `npx tsc --noEmit` — no new errors

### D.3 Regression Testing

- [ ] `npm run test:auth-permissions` — passes
- [ ] `npm run test:auth-audit` — passes
- [ ] `npm run test:subscription-schedule` — passes
- [ ] `npm run test:bento-interactions` — passes
- [ ] `npm run test:permission-layer` — passes
- [ ] `npm run build -- --webpack` — succeeds

### D.4 Manual Role Testing — Owner

- [ ] Login as Owner — successful
- [ ] Home dashboard loads with revenue, all cards, all Quick Access links
- [ ] Navigate to Finance — accessible
- [ ] Navigate to Staff Accounts — accessible
- [ ] Navigate to Activity Log — accessible
- [ ] Navigate to Bento > Production — accessible
- [ ] Navigate to Bento > Customers — accessible
- [ ] All BottomNav tabs visible: Home, Approvals, Schedule, Purchase, Me
- [ ] Sign out — successful

### D.5 Manual Role Testing — Manager

- [ ] Login as Manager — successful
- [ ] Home dashboard loads with revenue, all cards, all Quick Access links
- [ ] Navigate to Finance — redirected to /access-denied
- [ ] Navigate to Staff Accounts — redirected to /access-denied
- [ ] Navigate to Activity Log — redirected to /access-denied
- [ ] Navigate to Bento > Production — accessible
- [ ] Navigate to Bento > Customers — accessible
- [ ] All BottomNav tabs visible: Home, Approvals, Schedule, Purchase, Me
- [ ] Sign out — successful

### D.6 Manual Role Testing — Kitchen

- [ ] Login as Kitchen — successful
- [ ] Home dashboard loads WITHOUT revenue total
- [ ] Quick Access: Purchase, Inventory visible. Finance NOT visible. Staff NOT visible.
- [ ] Navigate to Finance — redirected to /access-denied
- [ ] Navigate to Staff — redirected to /access-denied
- [ ] Bento: orders visible, production visible, weekly menu visible
- [ ] Bento: Customers link NOT visible. Unpaid link NOT visible. New Order link NOT visible.
- [ ] BottomNav tabs visible: Home, Approvals, Purchase, Me. Schedule NOT visible.
- [ ] Sign out — successful

### D.7 Manual Role Testing — Front Desk

- [ ] Login as Front Desk — successful
- [ ] Home dashboard loads WITHOUT revenue total
- [ ] Quick Access: Dine-in, Reservations, Complaints visible. Purchase NOT visible. Inventory NOT visible.
- [ ] Navigate to Purchase — redirected to /access-denied
- [ ] Navigate to Inventory — redirected to /access-denied
- [ ] Bento: orders visible, customers visible, weekly menu visible
- [ ] Bento: Production link NOT visible
- [ ] BottomNav tabs visible: Home, Approvals, Me. Schedule NOT visible. Purchase NOT visible.
- [ ] Sign out — successful

### D.8 Edge Cases

- [ ] Unauthenticated request to `/finance` — redirected to `/login`
- [ ] Authenticated as Kitchen, direct URL to `/finance` — redirected to `/access-denied`
- [ ] Session expires during use — redirected to `/login?reason=session-ended`
- [ ] Suspended account attempts login — redirected to `/account-disabled`
- [ ] First-login password change enforced — redirected to `/change-password`

---

## E. Rollback Plan

### E.1 Risk Assessment

Phase 0 risk is **near zero**. The changes are:
- 4 new files that nothing imports
- 1 type addition (delivery role)
- 1 test script
- 1 package.json script entry

No existing code path is altered. No existing import is changed. No existing function signature is modified.

### E.2 Rollback Procedure

If any issue is discovered after Phase 0 commit:

```bash
# Option 1: Revert the Phase 0 commit
git revert <phase0-commit-hash>

# Option 2: Remove the new files and revert types.ts
git rm lib/auth/permissionKeys.ts
git rm lib/auth/rolePermissions.ts
git rm lib/auth/permissionCheck.ts
git rm lib/auth/permissionRouteMap.ts
git rm scripts/test-permission-layer.mjs
git checkout lib/auth/types.ts    # removes 'delivery' from STAFF_ROLES
git checkout package.json          # removes test script entry
```

### E.3 Impact of Rollback

| Rollback Action | Impact |
|----------------|--------|
| Remove `permissionKeys.ts` | None — no imports exist |
| Remove `rolePermissions.ts` | None — no imports exist |
| Remove `permissionCheck.ts` | None — no imports exist |
| Remove `permissionRouteMap.ts` | None — no imports exist |
| Remove `test-permission-layer.mjs` | None — standalone test |
| Revert `types.ts` | `delivery` removed from `StaffRole` type. If a delivery user was created (unlikely in Phase 0), their role value would fail the type check. No delivery users exist in Phase 0. |
| Revert `package.json` | `test:permission-layer` script removed |

**Total recovery time:** Less than 2 minutes.

### E.4 Prevention

- Phase 0 commit is atomic — all 7 files in one commit
- No other changes are bundled with Phase 0
- Commit message clearly marks it as `feat: define permission keys and role-permission mappings`
- The `git revert` approach is preferred (preserves history)

---

## F. Exit Criteria

Phase 0 is complete when ALL of the following are true:

### F.1 Code Criteria

- [ ] `lib/auth/permissionKeys.ts` exists with 51 `PERMISSION` constants
- [ ] `lib/auth/rolePermissions.ts` exists with 5 role-permission mappings
- [ ] `lib/auth/permissionCheck.ts` exists with `hasPermission()`, `hasAllPermissions()`, `hasAnyPermission()`, `getPermissionsForRole()`
- [ ] `lib/auth/permissionRouteMap.ts` exists with permission-to-route mappings
- [ ] `lib/auth/types.ts` includes `'delivery'` in `STAFF_ROLES`
- [ ] `scripts/test-permission-layer.mjs` exists and passes
- [ ] `package.json` includes `"test:permission-layer"` script

### F.2 Automated Test Criteria

- [ ] `npm run test:permission-layer` — all assertions pass
- [ ] `npm run test:auth-permissions` — passes (no regression)
- [ ] `npm run test:auth-audit` — passes (no regression)
- [ ] `npm run test:subscription-schedule` — passes (no regression)
- [ ] `npm run test:bento-interactions` — passes (no regression)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build -- --webpack` — successful production build

### F.3 Manual Test Criteria

- [ ] All 20 route access tests pass for all 4 roles (§C.2)
- [ ] No visual changes on any page for any role (§C.3)
- [ ] All 8 cross-role behavior tests pass (§C.4)
- [ ] Edge cases verified (§D.8)

### F.4 Owner Sign-Off

- [ ] Owner reviews the permission key names and confirms they are readable
- [ ] Owner reviews the role-permission assignments and confirms correctness
- [ ] Owner confirms no visual or behavioral changes observed
- [ ] Owner approves proceeding to Phase 0.5

### F.5 Commit Criteria

- [ ] Single atomic commit with message: `feat: define permission keys and role-permission mappings`
- [ ] No other changes bundled in the commit
- [ ] Commit pushed to feature branch (not main)
- [ ] PR opened for review against main

---

## Appendix A: Phase 0 File Manifest

```
NEW FILES (5):
  lib/auth/permissionKeys.ts
  lib/auth/rolePermissions.ts
  lib/auth/permissionCheck.ts
  lib/auth/permissionRouteMap.ts
  scripts/test-permission-layer.mjs

EDITED FILES (2):
  lib/auth/types.ts        (+1 line)
  package.json             (+1 line)

UNCHANGED FILES (all others):
  lib/auth/permissions.ts    (no changes)
  lib/auth/currentStaff.ts   (no changes)
  lib/auth/audit.ts          (no changes)
  proxy.ts                   (no changes)
  app/page.tsx               (no changes)
  app/components/*            (no changes)
  All module pages            (no changes)
  All server actions          (no changes)
  All database migrations     (no changes)
  All RLS policies            (no changes)
```

## Appendix B: Derived From Approved Design

Every element in this checklist is derived from the approved [permission-layer-design.md](permission-layer-design.md):

| Checklist Section | Design Source |
|-------------------|---------------|
| A.2 — In-scope deliverables | §F.3 Phase 0 actions |
| B.1 — permissionKeys.ts | §B.3 Permission Key definitions |
| B.2 — rolePermissions.ts | §B.3 Role Definition |
| B.3 — permissionCheck.ts | §B.4 Core Permission Functions |
| B.4 — permissionRouteMap.ts | §B.5 Permission-to-Route Mapping |
| B.5 — types.ts edit | §F.3 Phase 0, action 6 |
| C.2 — Route access matrix | §E.1 Full Permission Matrix |
| E — Rollback plan | §F.2 Guiding Principle (zero behavior change) |
| F.1 — Exit criteria | §F.3 Phase 0 verification |
