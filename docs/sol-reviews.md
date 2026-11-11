# Sol review ledger

Two sol-loop passes used provider `codex`, model `gpt-6.1-sol`, with verified `high` reasoning effort. Token usage was not exposed. Each round used one fresh read-only reviewer without reviewer subagents. No source was changed while a review ran; no push occurred during either loop before agreement.

## Rounds

| Pass          | Round | Reviewed behavior | Verdict                                          |
| ------------- | ----- | ----------------- | ------------------------------------------------ |
| Functionality | 1     | `6a844a1`         | Changes: F1–F6                                   |
| Functionality | 2     | `734f066`         | Approved; all F findings resolved                |
| UI/UX         | 1     | `bf3d577`         | Changes: U1/U2                                   |
| UI/UX         | 2     | `edc560a`         | U1/U2 resolved; U3 late-observer guard requested |
| UI/UX         | 3     | `2c2c395`         | Approved; U3 resolved                            |

The functionality pass grew from 79 files / 12,686 insertions / 7 deletions to 80 files / 12,954 insertions / 7 deletions. The UI pass grew from 80 files / 12,989 insertions / 7 deletions to 80 files / 13,096 insertions / 7 deletions. These are full baseline diffs, including tests and logbook, before this final documentation. Review base throughout: `2b4e69c0d046de27d0816da55c352dcf83a39752`.

## Findings

| ID  | Severity | Correction and regression                                                                                                                                          | Outcome                         |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| F1  | Blocker  | Create `public` before worker copy; prepare assets from a fresh temporary directory.                                                                               | Resolved, functionality round 2 |
| F2  | Blocker  | Lock source/engine/undo before accept/restore awaits; guard saves and unlock in finally. Held responses test attempted same-document typing and persisted results. | Resolved, functionality round 2 |
| F3  | Should   | Key editor by resume ID. Create another resume through commands and verify Undo cannot bring back prior private source.                                            | Resolved, functionality round 2 |
| F4  | Should   | Normalize terminal keyword punctuation while preserving Node.js/C++/C#. Exact `Required React.` regression.                                                        | Resolved, functionality round 2 |
| F5  | Should   | Token-boundary skill checks in replacements and evidence. Test ongoing/trust collisions and genuine Go/Rust claims.                                                | Resolved, functionality round 2 |
| F6  | Should   | Preserve exact-range conflicts through the Convex envelope. Authenticated emulator invokes the real invalid-proposal path and checks actionable 409 mapping.       | Resolved, functionality round 2 |
| U1  | Should   | Find reveals source and focuses search after dialog close. Test PDF/Assistant/ATS origins at 768px/390px, matching text and Escape focus.                          | Resolved, UI round 2            |
| U2  | Should   | Capture/restore dialog opener; retain command destination focus and chains. Test command/rename Escape focus.                                                      | Resolved, UI round 2            |
| U3  | Should   | Handle observer redraw cancellation and prevent initialization after disposal. Native-observer tracking asserts one after zoom, zero after leaving.                | Approved; U3 resolved           |

U3 began with a parent-observed `RenderingCancelledException` in strict browser diagnostics. The UI round 2 reviewer found the remaining continuation after the caught cancellation; the final guard follows the awaited initial draw. No findings were declined or left disputed.

Latest full verification: formatting, lint, types, production build, 34 Bun tests / 208 assertions, three Convex emulator tests and five Chromium cases passed. All seven diagnostic reports are empty; no errors were excluded. See [verification](verification.md) for scope, failures investigated and account setup limits.
