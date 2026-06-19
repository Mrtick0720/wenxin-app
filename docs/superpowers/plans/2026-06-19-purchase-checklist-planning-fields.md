# Purchase Checklist Planning Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist checklist specification and supplier details while simplifying only the “Add to Checklist” sheet to planning-focused fields.

**Architecture:** Add nullable columns to `purchase_checklist`, carry them through checklist action types and CRUD payloads, and render them as secondary metadata in checklist rows. Keep the shared edit sheet compatible, but give the add sheet a planning-only mode that hides category, unit, and unit price while retaining their existing internal defaults.

**Tech Stack:** Next.js 16, TypeScript, React, Tailwind CSS, Supabase/PostgreSQL.

---

### Task 1: Add persisted checklist fields

**Files:**
- Create: `supabase/migrations/20260619_purchase_checklist_planning_fields.sql`
- Modify: `app/purchase/checklist-actions.ts`

- [ ] Add nullable `specification text` and `supplier text` columns with `ADD COLUMN IF NOT EXISTS`.
- [ ] Extend `ChecklistEntry`, `ChecklistItemInput`, and `SELECT_COLS`.
- [ ] Trim and save both fields in add/edit payloads.
- [ ] Copy both values into the purchase record when completing a checklist item.

### Task 2: Simplify Add to Checklist

**Files:**
- Modify: `app/purchase/ChecklistSection.tsx`

- [ ] Extend form state with `specification` and `supplier`.
- [ ] Add an add-sheet mode to show only Item Name, Quantity, Specification, Supplier, and Note.
- [ ] Keep category/unit populated internally from catalog selection or existing defaults.
- [ ] Keep the edit sheet functional and able to edit the persisted planning fields.
- [ ] Pass specification and supplier through add/edit actions.

### Task 3: Show planning details

**Files:**
- Modify: `app/purchase/ChecklistSection.tsx`

- [ ] Render specification and supplier beneath the checklist item name when present.
- [ ] Preserve existing mobile swipe actions, quantity, creator, and completion behavior.

### Task 4: Verify

**Files:**
- Test: `app/purchase/ChecklistSection.tsx`
- Test: `app/purchase/checklist-actions.ts`
- Test: `supabase/migrations/20260619_purchase_checklist_planning_fields.sql`

- [ ] Run a static regression check proving the add sheet contains required labels and excludes Category, Unit, and Unit Price.
- [ ] Run ESLint on the modified TypeScript files.
- [ ] Run TypeScript checking and report unrelated pre-existing failures separately.
- [ ] Run `git diff --check`.
