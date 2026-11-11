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

The first full recheck passed the new 360px test but failed an existing immediate-Escape/focus-return assertion. A focused real-browser key trace then proved that Escape reached the focused search field and became default-prevented while the dialog remained open. The first content fallback skipped prevented events and did not resolve the failure. The current handler closes this application dialog explicitly on Escape; it retains the existing focus-return path. The 360px test repeats immediate open/Escape/focus-return three times in each theme, and existing tablet/phone assertions remain unchanged. A separate real Convex mutation timed out and correctly was not replayed. Failed and interrupted runs remain archived and are not counted as passes. Temporary diagnostic test code was removed.

## Verification after corrections

Behavior candidate: `cb6860c62bd14c7c3515d8558a50ef00121ade58`; non-document code digest: `e48eb477c80beee1d3c6c4a7eaaf277848e72c7eff9a007e23d1125e4854eb06`. The complete `refresh-review-gate3` gate passed formatting, types, lint, build, 50 Bun tests/321 assertions, three Convex tests and all 12 real-service Chromium cases in 5.0 minutes. A focused 360px run also passed before the complete browser run. The original assertions were preserved.

Nine diagnostic arrays are empty. Two narrowly classified cancellations during explicit navigation are recorded separately. The evidence manifest hashes 52 PNGs and seven videos. Test identities/documents are cleaned, the test server is stopped, and the same box keeps the user-requested preview running. External authenticated MCP remains intentionally unverified.

## Round 2

Focused recheck pending after verification of the two small fixes. No push occurs during the review loop.
