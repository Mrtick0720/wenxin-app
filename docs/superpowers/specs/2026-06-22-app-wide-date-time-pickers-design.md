# App-wide Date and Time Pickers Design

## Goal

Use one reliable date-field interaction and one consistent 24-hour time wheel across Wenxin Operations on iPhone, Android, and desktop browsers.

## Scope

- Replace every clickable `input[type="date"]` and `input[type="time"]`.
- Leave the two disabled attendance-history date inputs unchanged.
- Preserve existing stored values: dates remain `YYYY-MM-DD`; times remain `HH:mm`.
- Keep Edit Order date and time in one row.

## Components

`DatePickerField` renders a normal button-like field and keeps a visually hidden native date input. Clicking anywhere on the visible field calls `showPicker()` when available, with focus/click fallback for browsers without it. This prevents native input chrome from affecting layout while restoring desktop click behavior.

`TimePickerField` never invokes the browser time picker. It opens an app-controlled portal containing two independent scroll-snap columns: hours `00–23` and minutes `00–59`. Scrolling or tapping selects a value; Cancel discards the draft and Confirm emits `HH:mm`.

## Interaction

- Mobile: modal appears as a bottom sheet with safe-area padding.
- Desktop: the same picker appears centered with a constrained width.
- The selected row is centered and highlighted.
- Opening the picker scrolls both columns to the current value.
- Empty time fields default the draft to the current local hour and minute.
- Escape and backdrop clicks cancel.
- Date fields remain native because the requested cross-platform wheel requirement applies to time.

## Accessibility

- Visible triggers are real buttons.
- Labels are passed through `aria-label`.
- The time dialog uses `role="dialog"` and `aria-modal="true"`.
- Hour and minute choices are buttons and remain keyboard-selectable.

## Verification

- A regression script rejects clickable native date/time inputs outside the shared component.
- The script verifies 24 hours, 60 minutes, scroll snapping, portal rendering, and desktop `showPicker()` support.
- TypeScript and whitespace checks must pass.
