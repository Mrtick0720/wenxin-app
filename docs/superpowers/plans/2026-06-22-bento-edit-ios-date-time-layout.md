# Bento Edit iOS Date/Time Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Edit Order date and time controls from overflowing or overlapping on iPhone Safari.

**Architecture:** Keep the date and time fields in two columns and delegate both controls to the app-wide shared picker components. The date component owns the native picker trigger without exposing native chrome; the time component opens the cross-platform 24-hour wheel.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Node.js regression script

---

### Task 1: Lock down the mobile layout contract

**Files:**
- Create: `scripts/test-bento-edit-mobile-date-time.mjs`
- Modify: `app/bento/orders/[id]/edit/page.tsx`

- [ ] **Step 1: Write the failing regression check**

Create a source-level check that requires:

```text
grid grid-cols-2 gap-2
min-w-0
DatePickerField
TimePickerField
```

for the Edit Order date/time section.

- [ ] **Step 2: Run the check and verify it fails**

Run:

```bash
node scripts/test-bento-edit-mobile-date-time.mjs
```

Expected: failure because the current fixed-width flex layout does not include the shrink-safe grid contract.

- [ ] **Step 3: Implement the minimal layout fix**

Use a two-column mobile grid with the shared `DatePickerField` and `TimePickerField` components.

- [ ] **Step 4: Run focused and project verification**

Run:

```bash
node scripts/test-bento-edit-mobile-date-time.mjs
npx tsc --noEmit
```

Expected: both commands exit successfully.

- [ ] **Step 5: Inspect the final diff**

Confirm that only the date/time layout and its regression coverage changed, without disturbing the unrelated menu edits already present in the working tree.
