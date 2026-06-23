# App-wide Date and Time Pickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all clickable native date/time controls with a shared desktop-safe date trigger and a cross-platform 24-hour two-column time wheel.

**Architecture:** Add `DatePickerField` and `TimePickerField` in one client component module. Date selection delegates to a hidden native date input through `showPicker()`; time selection uses an app-rendered portal with independent hour and minute scroll-snap columns.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4

---

### Task 1: Shared picker contract

**Files:**
- Create: `scripts/test-date-time-pickers.mjs`
- Create: `app/components/DateTimePickerFields.tsx`

- [ ] Write a source-level regression test that rejects clickable native date/time inputs outside the shared component.
- [ ] Verify the test fails before the shared component and migrations exist.
- [ ] Implement the desktop-safe date trigger and portal-based 24-hour time wheel.
- [ ] Verify the component contract passes.

### Task 2: Migrate all clickable fields

**Files:**
- Modify: `app/reservations/NewReservationSheet.tsx`
- Modify: `app/receivables/ReceivableForm.tsx`
- Modify: `app/bento/new/page.tsx`
- Modify: `app/bento/orders/[id]/edit/page.tsx`
- Modify: `app/bento/customers/new/page.tsx`
- Modify: `app/bento/customers/[id]/edit/page.tsx`
- Modify: `app/bento/customers/[id]/page.tsx`
- Modify: `app/staff/activity/ActivityLogClient.tsx`

- [ ] Replace each clickable native date field with `DatePickerField`.
- [ ] Replace each native time field with `TimePickerField`.
- [ ] Preserve labels, values, minimum dates, and state updates.
- [ ] Keep the two disabled attendance-history inputs unchanged.

### Task 3: Verification

**Files:**
- Test: `scripts/test-date-time-pickers.mjs`

- [ ] Run `node scripts/test-date-time-pickers.mjs`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `git diff --check`.
- [ ] Re-scan the app and confirm no clickable native date/time inputs remain outside the shared component.
