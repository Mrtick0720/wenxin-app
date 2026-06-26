# Purchase Scroll Boundary Design

## Goal

Keep the Purchase checklist's maximum scroll position aligned with its visible content so the final row stops above the fixed add button instead of scrolling into a large blank region.

## Root Cause

The carousel track contains all three panels, including the much taller Received panel. Its vertical overflow is visible, so inactive panels extend the checklist's scrollable range even when the carousel container is sized to the active panel. Checklist rows can also change inside `ChecklistSection`, leaving the measured carousel height stale. The scroll area additionally applies bottom clearance twice: once as scroll padding and once as a trailing spacer.

## Design

- Observe the active carousel panel with `ResizeObserver` and update the carousel height whenever its rendered height changes.
- Clip vertical carousel overflow so inactive panels cannot contribute to the active tab's scroll range.
- Reset the scroll position when switching tabs so a shorter panel never inherits a previous panel's deep scroll offset.
- Keep one bottom clearance on the scroll container sized to place the final row above the fixed add button.
- Remove the duplicate trailing spacer.

## Verification

- Add a source-level regression test for the observer, tab scroll reset, and single bottom-clearance rule.
- Run the Purchase regression test, TypeScript checking, and lint for the changed files.
- Verify the Purchase page in the local browser at the top and maximum scroll positions.
