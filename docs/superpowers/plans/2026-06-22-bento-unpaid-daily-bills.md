# Bento Unpaid Daily Bills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group unpaid Bento orders into customer daily bills, show bill details on date tap, pay only the selected bill, and restore page scrolling.

**Architecture:** Extract pure grouping logic into a small module, then render customer and daily-bill views from that derived structure. Use a portaled bill-detail sheet for order lines and a single Supabase batch update scoped to the selected bill's order IDs.

**Tech Stack:** React 19, TypeScript, Supabase browser client, Node.js tests

---

### Task 1: Add failing daily-bill grouping tests

**Files:**
- Create: `app/bento/unpaid/dailyBills.ts`
- Create: `scripts/test-bento-unpaid-daily-bills.ts`
- Modify: `package.json`

- [ ] **Step 1: Write tests for grouping behavior**

Cover same-customer/same-date merging, separate dates, separate customers,
totals, order IDs, and exclusion of paid/canceled rows.

- [ ] **Step 2: Add the npm command**

```json
"test:bento-unpaid-bills": "node --import tsx scripts/test-bento-unpaid-daily-bills.ts"
```

- [ ] **Step 3: Run and confirm failure**

```bash
npm run test:bento-unpaid-bills
```

Expected: failure because daily-bill grouping is not implemented.

### Task 2: Implement daily-bill grouping

**Files:**
- Create: `app/bento/unpaid/dailyBills.ts`

- [ ] **Step 1: Define order, bill, and customer group types**

- [ ] **Step 2: Implement `groupUnpaidOrdersByCustomerAndDate`**

Normalize customer names for grouping, retain a display name, order dates
descending, calculate totals, and preserve order IDs.

- [ ] **Step 3: Run grouping tests**

```bash
npm run test:bento-unpaid-bills
```

Expected: pass.

### Task 3: Rebuild the Unpaid Orders hierarchy and scrolling

**Files:**
- Modify: `app/bento/unpaid/page.tsx`

- [ ] **Step 1: Make the page a full-height flex column**

Use `h-dvh`, `min-h-0`, and an inner `overflow-y-auto` content area with iOS
momentum scrolling and safe-area bottom padding.

- [ ] **Step 2: Render customer list and daily bills**

The initial list shows customers. Tapping a customer expands or opens their
date rows. Each date row shows bill total and order count.

- [ ] **Step 3: Add the bill detail sheet**

Render all order lines for the selected date in a portal. Place `Mark All Paid`
only inside this sheet.

### Task 4: Batch-pay only the selected daily bill

**Files:**
- Modify: `app/bento/unpaid/page.tsx`

- [ ] **Step 1: Update selected order IDs**

Update rows whose IDs belong to the selected bill:

```ts
{
  paid: true,
  payment_status: 'paid',
}
```

Set `amount_paid` per row to its own order amount.

- [ ] **Step 2: Reconcile local state**

Remove only the paid bill's IDs, close the sheet, and let grouping remove empty
dates/customers.

- [ ] **Step 3: Preserve the sheet on failure**

Show an error and keep the bill open if either update fails.

### Task 5: Verify

**Files:**
- Verify all files from Tasks 1–4

- [ ] **Step 1: Run checks**

```bash
npm run test:bento-unpaid-bills
npx tsc --noEmit
npx eslint app/bento/unpaid/page.tsx app/bento/unpaid/dailyBills.ts scripts/test-bento-unpaid-daily-bills.ts
git diff --check
```

Expected: all commands exit successfully.
