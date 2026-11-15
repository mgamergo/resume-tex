> Historical record. The in-app Assistant and proposal controls were removed. Current agent access uses [private MCP keys](agent-tools.md).

# Agent autonomy review

Base: `31576cb36192dd159a3e5fe4b01068e3844fa47d`. Review command: `git diff 31576cb36192dd159a3e5fe4b01068e3844fa47d`. Model: gpt-6.1-sol, high reasoning. Usage was not returned. No pushes during review.

## Round 1

Reviewed clean `9edf9ec`, including source, seven screenshots and verification logs. Verdict: changes. The reviewer ran no suites or browsers.

| Finding                                                          | Severity | Resolution                                                               |
| ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| S1: deletion retains a draft conflict and blocks new resumes     | should   | Clear conflict and deferred head after successful deletion.              |
| S2: deletion during acceptance or restore retains the apply lock | nit      | Release applying/loading state at the same successful-deletion boundary. |

The fix adds four cleanup statements. One real-service regression exercises conflict → delete → create, then held acceptance → delete → create, and verifies the late response cannot replace the new resume. No findings were declined.

Before review: 22 files, 1,881 insertions and 237 deletions. The behavior correction adds four source lines and its focused browser test. No new framework or module.

## Verification

Baseline behavior `4906819` passed format, application/Convex types, lint, build, 55 Bun tests/337 assertions, 11 Convex tests and the full 16-case connected Chromium suite.

Correction behavior `aa8827b` passed fresh format/types/lint/build, the same unit suites and the added real-service deletion regression. The baseline and correction evidence are separately identified in artifacts/autonomy-sol-evidence.json. Current diagnostic reports contain no unexpected errors; test-owned identities and the test server are cleaned. The same box retains the private preview.

## Round 2

Approved clean `585f1e1`: S1 and S2 resolved, no new findings and no further fix needed. The reviewer checked only the open findings and changed code, verified artifact hashes and all 12 empty diagnostic arrays, and ran no suites or browsers. Both rounds used gpt-6.1-sol on high reasoning. Usage was not returned. No findings were declined.

Final diff: 23 files, 2,031 insertions and 237 deletions. The growth after round 1 consists of the focused regression and review documentation; the runtime correction remains four cleanup statements. This approval record changes documentation only.
