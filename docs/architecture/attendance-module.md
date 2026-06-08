# Wenxin Attendance Module — Product Specification

**Date:** 2026-06-08
**Status:** Draft, pending review
**Depends on:** Staff Authentication (approved, implemented)

## 1. Goal

Add a standalone Attendance module to the Wenxin App. Enable staff to clock in and out for each work session, let managers see who is present in real time, and provide the owner with attendance records for payroll.

Attendance is a peer module to Staff and Schedule under the **People** category. It is accessed from the Home dashboard Quick Access grid and from links on the Schedule page.

The first version must provide:

- Clock in and clock out for every staff member, supporting multiple work sessions per day
- A real-time today view showing who is present, late, absent, or on leave
- Owner and Manager ability to view and correct attendance records
- Weekly shift assignment that replaces the current hardcoded schedule grid on `/staff`
- Attendance summary data for the Home dashboard's "Today's Issues" section
- Audit logging of clock events and record corrections

All visible App text remains English.

## 2. Scope

### Included

- Clock in / clock out with tap confirmation (one button per session)
- Multiple attendance sessions per staff per day (lunch shift, dinner shift, split shifts)
- Clock method tracking: `app`, `manager_manual`, `owner_correction`
- Today's attendance status board: Present, Late, Absent, On Leave
- Late threshold configurable by Owner (default: 15 minutes after shift start)
- Weekly shift assignment grid on `/staff` (replaces current hardcoded sample data)
- Shift types: Morning (09:00–15:00), Full (10:00–20:00), Afternoon (14:00–21:00), Off, Leave
- Owner and Manager can manually record or correct a clock event
- Owner and Manager can view attendance history per staff member
- Attendance summary widget on Home dashboard (replaces hardcoded "Lina - missing punch-out")
- Attendance data feeds "Today's Issues" low-stock and attendance issue detection
- Database-level audit trail for all clock events and corrections
- Row Level Security matching the existing four-role permission model
- Standalone L2 module at `/attendance` with its own card in the Home Quick Access grid

### Deferred

- Geofence / location verification of clock events
- Photo capture on clock in/out
- Biometric verification (fingerprint, face)
- Overtime calculation and approval workflows
- Payroll integration or hourly wage computation
- Leave request and approval workflow (leave is recorded as a shift type, not a request)
- Shared-device kiosk mode (staff clock in on their own devices)
- Break tracking (break start/end separate from work sessions)
- Schedule conflict detection and warnings
- Auto-scheduling or shift swap requests
- Calendar month view (weekly view only in v1)
- Overnight shift handling (clock-out on a different calendar date from clock-in)

## 3. Module Hierarchy

Attendance belongs to the **People** category:

```
People
  ├── Staff       (/staff/accounts, /staff/activity)
  ├── Schedule    (/staff)
  └── Attendance  (/attendance)  ← NEW
```

It is a standalone L2 module, not a sub-page of Staff or Schedule. It is accessed via:

- **Quick Access** card on the Home dashboard (`/attendance`)
- **Link** from the Schedule page header (`/staff` → `/attendance`)
- **Direct URL** (route-protected by `proxy.ts` and `requireCurrentStaff()`)

No new BottomNav tab is added. The existing five tabs (Home, Approvals, Schedule, Purchase, Me) remain unchanged.

## 4. User Stories

### Clock In / Out

1. A staff member arrives for their lunch shift, opens the App, and taps **Clock In**. The App starts a new attendance session. The Home dashboard and Attendance page immediately show them as Present.
2. At the end of their lunch shift, the staff member taps **Clock Out**. The App closes the session and records their hours worked.
3. The same staff member returns for the dinner shift, opens the App, and taps **Clock In** again. A second attendance session is created for the same calendar day.
4. If a staff member forgets to clock out, the Manager or Owner can close the open session with the actual end time and a required note.
5. A staff member who clocks in more than 15 minutes after their scheduled shift start is marked **Late**. The lateness is visible on the attendance board.

### Today's Attendance

6. The Owner or Manager opens the Attendance page and sees a live board: each staff member's status (Present / Late / Absent / On Leave / Off), current session clock-in time, active session count, and scheduled shift.
7. Kitchen and Front Desk staff see only their own clock status and session history when they open the Attendance page.

### Shift Assignment (on Schedule page)

8. The Owner or Manager opens the weekly schedule grid on `/staff` and assigns shifts to each staff member for the current and upcoming weeks.
9. The schedule grid shows the same Mon–Sun weekly view currently rendered with sample data, but reads and writes real database records from `staff_shifts`.
10. An attendance session can optionally reference a shift assignment (`schedule_id`), enabling the system to compare scheduled vs. actual hours.

### Attendance History

11. The Owner or Manager selects a staff member and views their attendance history: date, sessions (clock in, clock out, hours per session), total hours, scheduled shifts, and any manual corrections.
12. The Owner filters attendance history by date range and by staff member.

### Home Dashboard

13. The Home dashboard's "Today's Issues" section shows real attendance anomalies: missing clock-in for scheduled staff, open sessions past shift end, and late arrivals.

## 5. Session Model

An **attendance session** represents one continuous work period. A staff member can have zero, one, or multiple sessions on a given calendar day.

### Session Lifecycle

```
                   ┌──────────────┐
                   │  NO SESSION   │
                   └──────┬───────┘
                          │ clockInAction()
                          ▼
                   ┌──────────────┐
                   │  OPEN SESSION │  (clock_in = now, clock_out = null)
                   └──────┬───────┘
                          │ clockOutAction()
                          ▼
                   ┌──────────────┐
                   │ CLOSED SESSION│  (clock_in set, clock_out = now)
                   └──────────────┘
                          │
                          │ (Can start a new session)
                          ▼
                   [BACK TO NO SESSION]
```

### Clock In

- A staff member can clock in at any time, regardless of whether they have an existing open session.
- If an open session already exists and the staff member clocks in again, the previous session is automatically closed at the time of the new clock-in (with `clock_method` set to `app` and `end_reason` = `auto_closed`). A new session is then created. This prevents orphaned open sessions while allowing shift changes without manager intervention.
- Clock in creates a new row in `attendance_sessions`: `staff_user_id`, `business_date` (current date), `clock_in` (now), `clock_method` (`app`).
- If a `schedule_id` can be matched (a `staff_shifts` row exists for this staff member on this date whose shift window contains the current time), the session links to it. Otherwise `schedule_id` is null.

### Clock Out

- A staff member can clock out only if they have at least one open session (clock_in set, clock_out null).
- If multiple open sessions exist (should not happen in normal use), the most recent one is closed.
- Clock out updates the session: `clock_out` = now.
- The session's `hours_worked` is computed as `clock_out - clock_in`.

### Late Determination

- If the session has a linked `schedule_id`, the scheduled shift's start time is used.
- If no schedule is linked but a `staff_shifts` row exists for this staff member on this date with a working shift type, that shift's start time is used.
- Late = `clock_in > (shift_start + late_threshold_minutes)`.
- A session with no associated shift is never marked late (staff covering an unscheduled shift).

### Manual Correction

- Owner and Manager can open any closed session and edit `clock_in`, `clock_out`, or both.
- Every manual correction requires a required note (reason).
- The original values are preserved in the audit log's `before_data`.
- The `clock_method` is updated to `manager_manual` or `owner_correction`.
- Owner and Manager can also manually close an open session (set `clock_out`) with a required note.

### Late Threshold

- Default: 15 minutes after the scheduled shift start time.
- Configurable by Owner in `restaurant_settings` as `late_threshold_minutes` (range: 5–60).

## 6. Attendance Status Logic

For each staff member on a given date, the system derives one overall status from their shift assignments and attendance sessions:

| Condition | Status |
|-----------|--------|
| All scheduled shifts are "Off" and no sessions recorded | `off` |
| All scheduled shifts are "Leave" and no sessions recorded | `on_leave` |
| Has at least one open session (clocked in, not clocked out) | `present` |
| Has at least one closed session where clock_in was after shift_start + late_threshold | `late` |
| Has a working shift that has started, but no clock-in yet and shift has not ended | `pending` |
| Has a working shift that has ended, but no clock-in recorded | `absent` |
| Has a closed session with clock_in within threshold | `present` |

If a staff member has multiple shifts in one day (e.g., lunch + dinner), status reflects the current time: if the lunch shift ended and the dinner shift has not started, status is `off` between shifts.

Status is derived at query time, not stored. The only stored facts are: shift assignments, clock_in timestamps, clock_out timestamps, clock_method, and correction notes.

## 7. User Interface

### Clock In / Out Button

- Displayed on the Attendance page and on the Home dashboard (for the current user).
- States: **Clock In** (neutral, no open session), **Clock Out** (orange/prominent, open session exists), **Clocked Out** (green, all sessions closed for today, disabled).
- Tapping triggers a server action. Optimistic UI updates immediately; reverts on error.
- Shows the recorded time after the action completes.
- Kitchen and Front Desk see only their own clock button and session list. Owner and Manager see the full attendance board plus their own clock button.

### Today's Attendance Board (`/attendance` — Owner / Manager view)

- Cards or rows for each staff member: avatar initial, name, role, scheduled shift(s), current session clock-in, session count today, status badge.
- Sorted: Present → Late → Pending → Absent → On Leave → Off.
- Tap a staff member row to expand their today's sessions.
- Each session shows: clock in, clock out (or "Active" badge), hours, linked shift, clock method.

### Staff Session History (`/attendance?staffId=...`)

- Calendar strip at top for date selection.
- Summary card: total hours for the selected week, days worked, sessions count, late count.
- List of sessions grouped by date: clock in, clock out, hours, linked shift, status badge, clock method.
- Owner/Manager see an "Edit" button on each session that opens an inline correction form with time inputs and a required note field.

### Weekly Shift Grid (on `/staff`)

- Visually identical to the current hardcoded grid.
- Owner and Manager can tap a cell to change the shift type.
- Inline picker: Morning, Full, Afternoon, Off, Leave.
- Changes save immediately with optimistic update.

### Quick Access Card (on Home `/`)

- A new "Attendance" card appears in the Quick Access grid, visible to all roles.
- Uses `<NavLink href="/attendance">` to push the Attendance module onto the navigation stack.

## 8. Error Handling

- **Already have an open session:** Closes the previous session automatically and starts a new one. The UI shows both sessions after the action.
- **No open session to close:** Button shows "Clock In" state. "Clock Out" is not available.
- **Network failure during clock action:** Retain the intended action; retry with a "Tap to retry" message.
- **Manual correction without note:** "Enter a reason for this correction."
- **Invalid time entry:** "Enter a valid time." (Clock out must be after clock in for that session.)
- **Cannot close an already-closed session:** "This session is already closed."

## 9. Testing And Acceptance

Automated tests cover:

- Clock-in / clock-out state machine (multiple sessions per day, auto-close of orphaned sessions)
- Late threshold calculation (on time, exactly at threshold, after threshold)
- Attendance status derivation for all six states
- Permission checks: Kitchen cannot view another staff member's sessions
- Manual correction validation (note required, times must be valid)
- Audit log entries for clock events and corrections

Integration checks cover:

- Owner sees all attendance sessions; Manager sees all; Kitchen sees own only; Front Desk sees own only
- Clock-in updates the Home dashboard and Attendance page in real time
- Multiple same-day sessions are created and displayed correctly
- Auto-close of orphaned open sessions works correctly
- Shift grid on `/staff` saves and displays correctly
- Manual correction preserves original values in audit log
- RLS prevents direct database access to other staff members' attendance sessions

Before staff rollout:

1. Create shift assignments for all current staff in the staging environment.
2. Test clock in/out for one account of each role, including multi-session days.
3. Verify the attendance board shows correct statuses.
4. Test manual correction as Owner and Manager.
5. Verify audit entries for clock events and corrections.
6. Deploy and train staff.

## 10. Rollout

Phase one launches clock in/out with multi-session support, today's attendance board, weekly shift grid on `/staff`, and attendance history. Phase two (deferred) adds overtime, leave requests, and payroll export.

The existing hardcoded sample data on `/staff` is replaced by the `staff_shifts` table. The existing Staff Accounts (`/staff/accounts`) and Activity Log (`/staff/activity`) pages are unchanged. A new "Attendance" card appears in the Home Quick Access grid.
