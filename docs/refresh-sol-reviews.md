# Refresh Sol review

Scope: real-service runtime, system theme and UI refresh from `d2ea5bc`. The same diff is used each round: `git diff d2ea5bc4f3836ba5b90ed9b6f4e07467cacfd5bc HEAD`.

## Round 1

Requested model: gpt-6.1-sol, high reasoning, provider codex. Verdict: changes. The reviewer inspected all 44 before/after PNGs and their hashes, source, assertions and completed verification logs. No suites or browsers were run by the reviewer. Usage was not returned.

| ID  | Severity | Outcome                                                                                                                                                                                         |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | should   | Fixed: Compile has an explicit state-aware accessible name even when its text is hidden at 360px. Added real-browser accessible-name, keyboard compile, PDF and bounds coverage in both themes. |
| S2  | nit      | Fixed: renamed “Recent” to “Resumes”; UUID listing order makes no chronological claim.                                                                                                          |

The earlier advisory about a plain Error whose entire message is “fetch failed” remains a nonblocking follow-up. Normal business ConvexError instances are excluded and only queries can retry; the reviewer found no concrete caller evidence to escalate it.

The new 360px regression was run against the previous production build before rebuilding. It failed at the exact accessible-name assertion: expected “Compile”, received an empty name. The first invocation used an over-anchored test filter and discovered no tests; it is not counted as evidence.

Initial diff: 55 files, 2,501 insertions and 799 deletions.

The first full recheck passed the new 360px test but failed an existing immediate-Escape/focus-return assertion: the search field had focus while Radix had not yet installed its passive highest-layer keyboard listener. A content-level Escape handler now closes the active dialog when the event was not already handled. The 360px test repeats immediate open/Escape/focus-return three times in each theme; existing tablet/phone assertions remain unchanged. A separate real Convex mutation timed out and correctly was not replayed. This failed run is archived and is not counted as a pass.

## Round 2

Focused recheck pending after verification of the two small fixes. No push occurs during the review loop.
