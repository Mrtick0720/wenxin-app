# Wenxin Staff Authentication Design

**Date:** 2026-06-06
**Status:** Approved design, pending implementation review

## 1. Goal

Add a secure staff login and permission system before Wenxin App is opened to employees.

The first version must provide:

- Staff ID and password login
- Owner-created accounts only
- Mandatory password change after first login or password reset
- Role-based navigation, page access, and database access
- Twelve-hour maximum login sessions on personal employee devices
- Owner account administration
- Login duration and important-operation audit records
- A clean path to Passkey login after the production domain is fixed

All visible App text remains English.

## 2. Scope

### Included

- Login, first-password-change, unauthorized, and account-disabled screens
- Owner-only Staff Accounts page
- Account creation, suspension, reactivation, password reset, and forced logout
- Roles: Owner, Manager, Kitchen, Front Desk
- Route protection and role-aware navigation
- Row Level Security for application data
- Staff session records
- Audit logs for important data changes
- Current-user name and role in the App shell

### Deferred

- Passkey, fingerprint, Face ID, device PIN, and Android pattern login
- Public self-registration
- Customer login
- Shared-device mode
- Thirty-minute inactivity logout
- Payroll, attendance, scheduling, or HR functions

Passkey support is deliberately deferred because Supabase currently marks it experimental and Passkeys are bound to the final production domain.

## 3. Recommended Architecture

Use Supabase Auth for password authentication, Next.js server routes for privileged account operations, and PostgreSQL Row Level Security for authorization.

Employees see and enter a Staff ID such as `lina` or `kitchen01`. Internally, the server maps it to a private synthetic email identity such as `lina@staff.wenxin.internal`. The internal email is never presented as an employee-facing login field.

Privileged actions use a Supabase secret/service key only on the server. That key must never be sent to the browser or stored in a public environment variable.

The current browser-only Supabase client will be split into:

- Browser client: authenticated employee actions
- Server client: server-rendered pages using the employee session
- Admin client: Owner-only server routes for account management

## 4. Authentication Flow

### Initial login

1. Employee enters Staff ID and password.
2. The server normalizes Staff ID to lowercase and validates its format.
3. The App converts Staff ID to the internal identity and signs in through Supabase Auth.
4. The App checks that the staff profile is active.
5. A staff session record is created with a fixed expiry twelve hours after login.
6. If `must_change_password` is true, the employee is sent only to the Change Password screen.
7. After a successful password change, the employee enters the permitted App home screen.

### Password rules

- Owner assigns the initial password.
- Initial and reset passwords always set `must_change_password = true`.
- The employee must choose a new password before using the App.
- Owner cannot view an employee's current password.
- Passwords are stored and verified only by Supabase Auth.

### Session rules

- Each login expires after twelve hours, even if the employee remains active.
- There is no inactivity timeout because employees use personal devices.
- When a session expires, the App signs out and returns to Login.
- A normal logout closes the current session record.
- Owner forced logout revokes the employee's active authentication sessions and closes open staff session records.
- Suspension immediately blocks the employee through both application checks and database policies.

Closing a browser or losing network access may prevent an exact logout timestamp. In that case, duration is calculated from login time to the last recorded activity, capped at twelve hours.

## 5. Roles And Permissions

| Area | Owner | Manager | Kitchen | Front Desk |
|---|---:|---:|---:|---:|
| Home | Yes | Yes | Yes | Yes |
| Bento overview and daily orders | Yes | Yes | Limited | Yes |
| Bento production | Yes | Yes | Yes | No |
| Bento customers and subscriptions | Yes | Yes | No | Yes |
| Reservations | Yes | Yes | No | Yes |
| Complaints | Yes | Yes | No | Yes |
| Tasks | Yes | Yes | Yes | Yes |
| Inventory | Yes | Yes | Yes | No |
| Purchase | Yes | Yes | Yes | No |
| Dine-in | Yes | Yes | No | Yes |
| Incidents | Yes | Yes | No | Yes |
| Reports | Yes | Yes | No | No |
| Finance | Yes | No | No | No |
| Staff operations page | Yes | Yes | No | No |
| Staff account administration | Yes | No | No | No |
| Activity Log | Yes | No | No | No |

Kitchen's Bento access is limited to daily order and production information. Kitchen cannot edit customer identity, subscription, payment, or account information.

Unauthorized destinations are removed from navigation. Direct URL access is also denied and redirected to an English `Access denied` screen.

## 6. Data Model

### `staff_profiles`

- `id`: UUID, references `auth.users.id`
- `staff_id`: unique lowercase login name
- `display_name`
- `role`: `owner | manager | kitchen | front_desk`
- `active`
- `must_change_password`
- `created_by`
- `created_at`
- `updated_at`
- `last_login_at`
- `sessions_invalidated_at`

Staff IDs accept lowercase letters, numbers, dots, underscores, and hyphens. They cannot be changed after account creation in version one, avoiding identity and audit ambiguity.

### `staff_sessions`

- `id`
- `staff_id`
- `auth_user_id`
- `started_at`
- `last_seen_at`
- `expires_at`
- `ended_at`
- `end_reason`: `logout | expired | forced | suspended`
- `device_summary`

The App updates `last_seen_at` at a restrained interval during authenticated use rather than on every tap.

The Supabase Auth `session_id` claim is the source identity for a login session. `staff_sessions` mirrors the employee-facing information needed for duration and device reporting.

### `audit_logs`

- `id`
- `actor_user_id`
- `actor_staff_id`
- `action`
- `entity_type`
- `entity_id`
- `summary`
- `before_data`
- `after_data`
- `created_at`

Audit logs are append-only. Employees cannot edit or delete them. Operational table changes are captured by database triggers so logging does not depend on every screen remembering to submit a separate log request. Owner account actions that occur on the server write their own audit entries.

## 7. Audit Policy

Record:

- Login success and logout
- Password change and Owner password reset
- Account creation, suspension, reactivation, role change, and forced logout
- Creation, update, cancellation, restoration, or deletion of operational records
- Bento subscription schedule and order changes
- Payment-status changes
- Important customer, inventory, purchase, complaint, incident, task, finance, and staff-data changes

Do not record:

- Every page view
- Every tap, scroll, or calendar selection
- Password values
- Authentication tokens
- Secret keys
- Unchanged form submissions

Owner's Activity Log provides filters for employee, date, action, and business area. Each entry shows who acted, when, what changed, and a readable before/after summary.

## 8. Authorization And Security

Three layers enforce access:

1. **Navigation:** employees see only permitted destinations.
2. **Server route guard:** protected pages require an active authenticated profile, a valid twelve-hour staff session, and the correct role.
3. **Database RLS:** direct browser requests are authorized using the authenticated user, active staff profile, role, Auth `session_id`, and session start time.

Owner-only account administration runs through protected server endpoints. Creating users, resetting passwords, revoking sessions, and changing roles never occurs directly from browser code.

All existing business tables must have RLS enabled before employee rollout. Policies follow least privilege and mirror the role matrix. Existing data remains unchanged during the authentication migration.

A security-definer database helper validates that the Auth session still exists, belongs to the current user, started less than twelve hours ago, and was created after `sessions_invalidated_at`. This makes the twelve-hour limit, suspension, and Owner forced logout apply to direct database requests as well as page navigation. If the Supabase project later uses a plan with native time-boxed sessions, its twelve-hour setting provides an additional authentication-layer safeguard.

The Home screen is role-aware. Owner and Manager may see business totals; Kitchen and Front Desk see only operational cards and links permitted to their roles. Giving a role access to Home never implicitly grants access to revenue, finance, reports, or restricted alerts.

## 9. User Interface

### Login

- Wenxin name as the primary brand signal
- `Staff ID`
- `Password`
- Show/hide password control
- `Sign in`
- Clear English error states without exposing whether a Staff ID exists

There is no Sign Up or Forgot Password link. Employees contact Owner for a reset.

### First password change

- `New password`
- `Confirm password`
- Password requirements
- `Update password`
- Logout option

No operational navigation is visible until the password is changed.

### Staff Accounts

Owner can:

- Search and filter staff
- Create a Staff ID, display name, role, and initial password
- See status, role, last login, and current-session state
- Suspend or reactivate an account
- Reset password
- Force logout
- Open the employee's activity history

Destructive actions require confirmation.

## 10. Error Handling

- Invalid credentials: `Staff ID or password is incorrect.`
- Suspended account: `This account has been suspended. Contact the owner.`
- Expired session: `Your 12-hour session has ended. Please sign in again.`
- Unauthorized page: `You do not have access to this area.`
- Network failure: retain entered Staff ID and show a retryable message.
- Account creation conflict: `This Staff ID is already in use.`

Server errors are logged without including passwords, tokens, or secrets.

## 11. Testing And Acceptance

Automated tests cover:

- Staff ID normalization and validation
- Role-to-route permission decisions
- First-login password-change enforcement
- Twelve-hour expiry decisions
- Suspended-account denial
- Audit-log sanitization
- Owner-only account operations

Integration checks cover:

- Each role can open only its permitted pages
- Hidden links cannot be bypassed by entering URLs
- RLS rejects unauthorized database reads and writes
- Password reset forces another password change
- Forced logout invalidates an active employee session
- Existing Bento, Purchase, Tasks, and other allowed workflows still function after authentication

Before employee rollout:

1. Create and verify the Owner account.
2. Apply authentication tables and RLS policies in a staging environment.
3. Test one account for every role.
4. Verify audit entries for representative create, update, cancel, and delete actions.
5. Deploy to the final HTTPS domain.
6. Create real employee accounts.

## 12. Rollout

Phase one launches Staff ID and password authentication with the approved role matrix. Phase two enables Passkey only after the production domain is stable and Supabase Passkey support is acceptable for production use.

The existing uncommitted Bento subscription work remains separate from this authentication feature and must not be included accidentally in authentication commits.
