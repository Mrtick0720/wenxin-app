# Wenxin Checklist Module — Product Specification

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** Staff Authentication (approved, implemented)

## 1. Goal

Add a standalone Checklist module to standardize daily outlet operations and ensure SOP compliance. Every shift, staff must complete assigned checklists — opening procedures, closing procedures, kitchen hygiene, stock checks, and cash closing. Failed items automatically generate incidents or follow-up tasks, creating a closed loop from inspection to resolution.

Checklist is a peer module under the **Operations Control** category:

```
Operations Control
  ├── Complaints
  ├── Incidents
  ├── Tasks
  └── Checklist  ← NEW
```

It is a standalone L2 module accessed from the Home dashboard Quick Access grid. No new BottomNav tab is added.

The first version must provide:

- Five checklist types: Opening, Closing, Kitchen Hygiene, Stock Check, Cash Closing
- Template-based checklist definitions with ordered items
- Auto-scheduling of recurring checklists (daily opening/closing)
- Role-based assignment (checklists assigned to specific staff roles)
- Item-by-item completion with pass/fail/skip responses
- Supervisor verification workflow for completed checklists
- Automatic overdue detection when checklists are not completed on time
- Failed critical items auto-create incidents
- Failed non-critical items auto-generate follow-up tasks
- Attendance integration: staff must be clocked in to complete checklist items
- Cash Closing Checklist linked to cashier closing workflow
- Stock Check Checklist generates inventory alerts on low-stock failures
- Owner and Manager access to checklist history and reports
- Audit logging of all checklist completions, verifications, and corrections
- Future multi-outlet support via `outlet_id`

All visible App text remains English.

## 2. Scope

### Included

- Five checklist templates: Opening, Closing, Kitchen Hygiene, Stock Check, Cash Closing
- Template management UI (Owner/Manager create, edit, reorder items)
- Auto-scheduling engine for recurring daily checklists
- Checklist instance lifecycle: pending → in_progress → completed → verified
- Item-level responses: pass, fail, skip (with required note on fail)
- Supervisor verification (Manager reviews and approves completed checklists)
- Overdue detection and flagging (checklist not completed by deadline)
- Critical item failures → auto-create incidents
- Non-critical item failures → auto-generate tasks
- Attendance gating: staff must have an open attendance session
- Stock check failures → inventory alert linkage
- Cash closing checklist → cashier workflow linkage
- Checklist completion reports (by date, by type, by staff member)
- Compliance scoring (percentage of items passed per checklist)
- Row Level Security matching the existing four-role model
- Audit logging via existing `write_operational_audit()` trigger
- `outlet_id` column on all tables for future multi-outlet support (defaults to primary outlet)

### Deferred

- Custom checklist types created by Owner/Manager through the UI (v1 uses seeded templates, editable but not creatable from scratch)
- Photo evidence attachment on checklist items
- Digital signature capture on verification
- Checklist scheduling by time window (v1 uses a single scheduled time per checklist type)
- Shift-based assignment (v1 assigns by role, not by named staff member)
- Mobile push notifications for overdue checklists
- Offline checklist completion with sync
- Regulatory compliance reporting exports
- Multi-outlet management UI (schema supports it, UI does not)
- Checklist version history and diff

## 3. Module Hierarchy

```
Operations Control
  ├── Complaints   (/complaints)
  ├── Incidents    (/incidents)
  ├── Tasks        (/tasks)
  └── Checklist    (/checklist)  ← NEW
```

Checklist is accessed via:

- **Quick Access** card on the Home dashboard (`/checklist`)
- **Direct URL** (route-protected by `proxy.ts` and `requireCurrentStaff()`)

No new BottomNav tab. The existing five tabs remain unchanged.

## 4. Checklist Types

Five checklist types are seeded in v1. Each is defined by a template with ordered items.

| # | Type | `checklist_type` | Runs | Assigned Role | Requires Verification |
|---|------|-----------------|------|---------------|----------------------|
| 1 | Opening Checklist | `opening` | `opening` (08:00) | Kitchen + Front Desk | Yes (Manager) |
| 2 | Closing Checklist | `closing` | `closing` (21:00) | Kitchen + Front Desk | Yes (Manager) |
| 3 | Kitchen Hygiene | `kitchen_hygiene` | `morning` (10:00), `afternoon` (16:00) | Kitchen | Yes (Manager) |
| 4 | Stock Check | `stock_check` | `daily` (09:00) | Kitchen | No |
| 5 | Cash Closing | `cash_closing` | `cash_closing` (21:00) | Front Desk | Yes (Manager) |

**Notes:**
- Each checklist type has one or more **runs**. A run is defined by a `run_key` and a `scheduled_time`. The auto-scheduler creates one instance per run per business day.
- Kitchen Hygiene has two runs (`morning` at 10:00, `afternoon` at 16:00). This is handled by two rows in `checklist_template_runs`, not by special-case code.
- The uniqueness rule for active instances is `(template_id, business_date, outlet_id, run_key)` — so each run gets its own instance.
- Stock Check does not require verification but failures generate inventory alerts.
- Cash Closing is linked to the cashier closing workflow — the Cashier module queries checklist completion status.
- Future checklist types will be creatable from the UI. New runs can be added to existing templates.

## 5. Business Rules

### BR-1: Staff Must Be Clocked In
A staff member must have an open attendance session (clocked in, not clocked out) before they can start or respond to a checklist instance. This is enforced in the server action. If no open session exists, the action returns an error: "Clock in before completing checklists."

### BR-2: Role-Based Assignment
Checklist instances are assigned to a role, not a named individual. Any staff member with the matching role who is clocked in can pick up and complete the checklist. The `assigned_role` on the template determines eligibility. The `completed_by` on the instance records who actually completed it.

### BR-3: Item Order
Items within a template have a defined `sort_order`. Items may be completed in any order by default. A future `requires_sequential` flag on the template can enforce sequential completion, but this is deferred to v2.

### BR-4: Critical Items
Items marked `is_critical = true` that receive a `fail` response automatically create an incident record. The incident is created with `severity = 'high'` and linked to the checklist instance.

### BR-5: Non-Critical Failed Items
Items marked `is_critical = false` that receive a `fail` response automatically create a follow-up task. The task is created with `priority = 'medium'` and linked to the checklist instance.

### BR-6: Verification
Checklists with `requires_verification = true` must be reviewed by a Manager (or Owner) after completion. The verifier reviews each item response, can add notes, and either approves (status → `verified`) or rejects (status returns to `in_progress` with a note). Verification is a separate action from completion.

### BR-7: Overdue
A checklist instance becomes `overdue` when `scheduled_time` passes and the status is still `pending` or `in_progress`. Overdue status is derived at query time (comparing `scheduled_time` against `now`), not set by a background job. The UI displays overdue checklists with a red badge. Overdue checklists appear on the Home dashboard's "Today's Issues" section.

### BR-8: One Active Instance Per Run Per Day
Only one instance of each run can be active (`pending` or `in_progress`) per business date per outlet. Uniqueness is enforced on `(template_id, business_date, outlet_id, run_key)`. Templates with multiple runs (e.g., Kitchen Hygiene with `morning` and `afternoon`) naturally get separate instances — no special-case code. Each run is independently scheduled and tracked.

### BR-9: Cash Closing Dependency
The Cash Closing checklist is linked to the cashier shift-end workflow. The Cashier module checks that the Cash Closing checklist instance for today is `verified` before allowing the cashier to close their shift. This is a read-only cross-module reference.

### BR-10: Stock Check Alerts
When a Stock Check checklist item fails and the item is tagged with an inventory SKU or category, an inventory alert is generated. The Inventory module reads these alerts from a shared view or the checklist item responses table.

## 6. Lifecycle & Status Model

### Instance Statuses

| Status | Meaning | Entered When |
|--------|---------|-------------|
| `pending` | Scheduled but not started | Auto-created at the scheduled time (or at the start of the business day) |
| `in_progress` | Staff has begun responding to items | First item response is recorded |
| `completed` | All items have been responded to | Last required item receives a response |
| `verified` | Manager has reviewed and approved | Manager submits verification approval |
| `overdue` | Not completed by deadline | Derived: `scheduled_time < now` AND status IN (`pending`, `in_progress`) |

### Item Response Statuses

| Status | Meaning | Requires Note |
|--------|---------|---------------|
| `pass` | Item checked and compliant | No |
| `fail` | Item checked and NOT compliant | Yes — required |
| `skip` | Item not applicable today | Yes — required reason |
| `pending` | Item not yet responded to | No (initial state) |

### State Transitions

```
                    ┌──────────┐
                    │ pending   │  (auto-created at scheduled time)
                    └────┬─────┘
                         │ first item response recorded
                         ▼
                    ┌──────────┐
                    │in_progress│
                    └────┬─────┘
                         │ all items responded to
                         ▼
                    ┌──────────┐
                    │ completed │
                    └────┬─────┘
                         │ manager verifies
                         ▼
                    ┌──────────┐
                    │ verified  │  (terminal)
                    └──────────┘

   pending ────(scheduled_time passes)──→ overdue
   in_progress ────(scheduled_time passes)──→ overdue

   completed ────(manager rejects)──→ in_progress (with rejection note)
```

**Transition rules:**
- `pending` → `in_progress`: automatic on first item response
- `in_progress` → `completed`: automatic when all items have a non-pending response
- `completed` → `verified`: Manager action with approval
- `completed` → `in_progress`: Manager rejection (items need rework)
- `pending` / `in_progress` → `overdue`: derived at query time, not a stored transition
- Once `verified`, the instance is immutable except by Owner override (deferred to v2)

## 7. Templates & Items

### Template Structure

A checklist template defines:
- **Name**: Display name (e.g., "Opening Checklist")
- **Type**: Enum value (`opening`, `closing`, `kitchen_hygiene`, `stock_check`, `cash_closing`)
- **Description**: What this checklist covers
- **Assigned Role**: Which role must complete it
- **Is Recurring**: Whether it auto-schedules daily
- **Scheduled Time**: Time of day when it should be started (e.g., "08:00")
- **Requires Verification**: Whether a Manager must approve
- **Is Active**: Whether it currently auto-schedules

### Item Structure

Each template has ordered items:

- **Description**: What to check (e.g., "All gas burners are turned off")
- **Category**: Grouping label (e.g., "Equipment", "Hygiene", "Safety", "Stock")
- **Sort Order**: Position within the checklist
- **Is Critical**: Failure auto-creates an incident
- **Requires Note On Fail**: Whether a note is mandatory on failure (always true for critical items)
- **Inventory Reference**: Optional link to an inventory item (for Stock Check type)

### Example: Opening Checklist Items

| # | Category | Item | Critical |
|---|----------|------|:--------:|
| 1 | Equipment | All gas burners functioning | Yes |
| 2 | Equipment | Rice cookers operational | Yes |
| 3 | Equipment | Exhaust fans running | No |
| 4 | Hygiene | Kitchen surfaces sanitized | Yes |
| 5 | Hygiene | Hand washing station stocked | No |
| 6 | Stock | Cooking oil sufficient | No |
| 7 | Stock | All menu ingredients available | Yes |
| 8 | Safety | Fire extinguisher accessible | Yes |
| 9 | Safety | First aid kit stocked | No |
| 10 | Front | Tables set and clean | No |

## 8. Assignment Model

### Template-Level Assignment

Each template has an `assigned_role`. The checklist instance inherits this role assignment.

| Template | Assigned Role |
|----------|--------------|
| Opening Checklist | `kitchen` |
| Closing Checklist | `kitchen` |
| Kitchen Hygiene | `kitchen` |
| Stock Check | `kitchen` |
| Cash Closing | `front_desk` |

### Instance-Level Assignment

When an instance is created, `assigned_role` is copied from the template. The `completed_by` field is null until a staff member starts the checklist. Any staff member with the matching role who is clocked in can claim and complete the instance.

**Rule**: Only one staff member works on a checklist instance at a time. The first staff member to record an item response becomes `completed_by`. Other staff members with the same role can view but not modify another staff member's in-progress checklist (unless they are Owner/Manager).

### Multi-Staff Scenarios

For checklists that span roles (e.g., Opening Checklist may involve both Kitchen and Front Desk), the template's `assigned_role` determines who is primarily responsible. Cross-role checklist support (multiple assignees per instance) is deferred to v2.

## 9. Completion Workflow

1. Staff member opens the Checklist module. They see today's pending checklists filtered to their role.
2. They tap a checklist instance to open it.
3. The system verifies they have an open attendance session. If not, the checklist opens in read-only mode with a "Clock in to start" message.
4. Staff member works through items, tapping Pass / Fail / Skip for each.
5. On Fail or Skip, a note field appears (required).
6. Progress is saved after each response (individual item writes, not a single save-at-end).
7. When the last pending item receives a response, the instance automatically transitions to `completed`.
8. A completion summary shows: total items, passed, failed, skipped.
9. If any critical items failed, incidents are created. If any non-critical items failed, tasks are created.
10. If the template requires verification, a "Pending verification" banner is shown.

## 10. Verification Workflow

1. Manager opens the Checklist module. They see a "Pending Verification" filter tab.
2. They tap a completed checklist instance.
3. The review view shows all item responses with pass/fail/skip badges and notes.
4. Manager can add a verification note.
5. Manager taps **Approve**: status → `verified`. The instance is locked.
6. Manager taps **Reject**: status → `in_progress`. A rejection note is required. The original staff member must address failed items and re-submit.
7. Verified checklists appear in reports and compliance dashboards.
8. Manager can also verify their own completed checklists (Owner can verify any).

## 11. Overdue Handling

- Overdue is derived, not stored. At query time: if `scheduled_time < now` AND `status IN ('pending', 'in_progress')`, the instance is flagged as overdue.
- Overdue checklists appear at the top of the checklist list with a red "Overdue" badge.
- Overdue instances appear on the Home dashboard's "Today's Issues" section: `{ type: 'Overdue Checklist', detail: '<Checklist Name>', link: '/checklist' }`.
- No automatic escalation in v1. Escalation (auto-notify Manager) is deferred.

## 12. Exceptions & Failures

### Critical Item Failure → Incident

When a checklist instance reaches `completed` status, the server action processes critical failures:

```
For each item_response WHERE status = 'fail' AND template_item.is_critical = true:
  INSERT INTO incidents (
    date: today,
    title: 'Checklist Failure: {checklist_name} — {item_description}',
    incident_type: 'checklist',
    severity: 'high' (critical items) or 'medium' (non-critical),
    status: 'open',
    checklist_instance_id: {instance.id},
    reported_by: {completed_by}
  )
```

### Non-Critical Item Failure → Task

```
For each item_response WHERE status = 'fail' AND template_item.is_critical = false:
  INSERT INTO tasks (
    date: today,
    title: 'Checklist Follow-up: {item_description}',
    task_type: 'checklist',
    priority: 'medium',
    status: 'pending',
    checklist_instance_id: {instance.id},
    assigned_role: {template.assigned_role}
  )
```

### Duplicate Prevention

Before creating an incident or task, the system checks if one already exists for this checklist instance + item combination (using `checklist_instance_id`). If a matching incident/task already exists, no duplicate is created.

## 13. Integrations

### Attendance
- **Gate**: `clockInAction()` in the checklist module verifies an open attendance session exists before allowing item responses.
- **Check**: `SELECT FROM attendance_sessions WHERE staff_user_id = X AND business_date = today AND clock_out IS NULL LIMIT 1`.
- **UX**: Without an open session, the checklist opens read-only with a banner: "Clock in to complete checklists."

### Cashier
- **Cash Closing Checklist**: The Cashier module reads `checklist_instances` to verify that the Cash Closing checklist for today is `verified` before allowing shift close.
- **Reference**: The Cashier module queries `WHERE checklist_type = 'cash_closing' AND business_date = today AND status = 'verified'`.

### Inventory
- **Stock Check Alerts**: When a Stock Check item tagged with an inventory reference fails, an alert record is created.
- **Alert table**: A lightweight `inventory_alerts` table (or the existing Inventory module's alert mechanism) receives the alert. The Inventory module queries it.
- **Deferred**: The Inventory module itself is not yet implemented with real data. The alert mechanism is designed but will be wired when Inventory is built.

### Incidents
- **Auto-creation**: Critical failed items create incidents (see Section 12).
- **Cross-reference**: Incidents include `checklist_instance_id` for traceability.
- **Dashboard**: Incidents created from checklists appear on the Home dashboard's alert cards (Incident count).

### Tasks
- **Auto-creation**: Non-critical failed items create tasks (see Section 12).
- **Cross-reference**: Tasks include `checklist_instance_id` for traceability.
- **Dashboard**: Tasks created from checklists appear on the Home dashboard and the Tasks/Approvals page.

## 14. Reporting

### Today's Checklist Status (Home Dashboard)
- Quick Access card shows a count badge: "X pending, Y overdue"
- Today's Issues section lists overdue checklists

### Checklist Module Reports (v1)
- **Today view**: All today's instances grouped by type, with status badges
- **History view**: Filter by date range, checklist type, status, staff member
- **Compliance score**: `(passed_items / total_items) × 100` per instance
- **Failed items log**: All failed items with their generated incidents/tasks

### Deferred Reports
- Weekly/monthly compliance trends
- Staff performance comparison (completion rate, average time to complete)
- Failed item category analysis

## 15. User Interface

### Checklist List (`/checklist` — default view)
- Grouped by status: Overdue → In Progress → Pending → Completed → Verified
- Each instance card shows: checklist name, scheduled time, status badge, item progress (e.g., "7/10"), assigned role
- Filter tabs: All, My Checklists, Pending Verification (Manager only), History
- Tap an instance to open the detail view

### Checklist Detail (instance view)
- Header: checklist name, business date, scheduled time, status badge
- Staff section: "Being completed by {name}" or "Assigned to {role}"
- Item list: description, category label, Pass / Fail / Skip buttons (or badge if already responded)
- Fail/Skip: inline note field appears after selection
- Progress bar: X of Y items completed
- Submit area: shown when all items are responded to; summary before finalizing
- Verification section (Manager): Approve / Reject buttons + note field (shown for completed instances)

### Template Management (Owner/Manager — `/checklist/templates`)
- List of active templates with item count and type
- Edit template: add/reorder/edit/remove items
- Toggle active/inactive
- Deferred: create new template type

## 16. Error Handling

- **Not clocked in**: "Clock in before completing checklists. Go to Attendance." (link to `/attendance`)
- **Wrong role**: "This checklist is assigned to {role}. You are {user_role}." (checklist opens read-only)
- **Already completed by another staff member**: "This checklist is being completed by {name}." (opens read-only)
- **Verification rejected**: "This checklist was returned for revision. Reason: {note}" (status returns to in_progress)
- **Network failure during item save**: Retry indicator on the specific item; other item responses are preserved
- **Duplicate incident/task**: Silently skipped (no error shown to user)

## 17. Testing & Acceptance

Automated tests cover:

- Checklist instance auto-scheduling logic (daily recurring, time-based)
- Status transitions (pending → in_progress → completed → verified)
- Role-based visibility (Kitchen sees kitchen checklists; Front Desk sees front_desk checklists)
- Attendance gating (no clock-in = cannot respond to items)
- Critical item failure → incident creation
- Non-critical item failure → task creation
- Duplicate incident/task prevention
- Overdue derivation at query time
- Permission checks for verification (only Manager/Owner can verify)

Integration checks:

- Owner sees all checklists; Manager sees all; Kitchen sees kitchen-assigned; Front Desk sees front_desk-assigned
- Cash Closing checklist is queryable by the Cashier module
- Stock Check failures generate inventory alerts
- Checklist completion updates the Home dashboard
- Verified checklists appear in reports
- RLS prevents cross-role checklist access

## 18. Rollout

Phase one launches the five seeded templates, auto-scheduling, completion workflow, verification workflow, incident/task generation, and basic reporting. Phase two adds custom template creation from the UI, photo evidence, digital signatures, and compliance trend reports.

The existing Complaints, Incidents, and Tasks modules are not modified. Checklist-generated incidents and tasks appear alongside manually created ones.
