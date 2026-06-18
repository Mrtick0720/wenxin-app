# Staff Archive Button Safari Consistency Design

## Problem

The iPhone Safari screenshot was captured before the local component update that added the Archive button. The current component already renders Archive for active and suspended non-owner accounts, but the behavior is not protected by a regression test and a temporary development debug panel remains visible.

## Design

- Centralize the allowed account action keys in a small pure helper.
- Active non-owner accounts expose Reset password, optional Force logout, Suspend, and Archive.
- Suspended non-owner accounts expose Reactivate and Archive.
- Archived non-owner accounts expose Restore.
- Owner accounts expose no destructive account actions.
- Keep the existing wrapping action-row layout so buttons remain visible on narrow iPhone Safari viewports.
- Remove the temporary yellow development debug panel.

## Verification

- Add a Node-based regression test for action visibility across account states.
- Add source-level assertions that the action row wraps and the debug panel is absent.
- Run the regression test, TypeScript checking, and ESLint on the touched files.
- Verify the live Staff Accounts page at an iPhone-sized viewport.

