# Real-service refresh verification

The refresh uses real Clerk sessions, the deployed private Convex workspace, the configured compatible model, and the isolated TeX compiler. Runtime local stores, model mocks, browser draft recovery, fictional starter content and product mode switches are removed. Historical local documents and browser keys remain untouched and are not migrated.

## Candidate and commands

Final candidate, code digest and successful command logs are recorded in `artifacts/refresh-final-complete.json`. All verification ran in the existing authorized box, checkout `/home/boxes/repos/resume-tex`, with one headless Chromium worker. Bun remains the package manager and build/test runner; Next runs on Node 22.

The dedicated Infisical project injected real service configuration for these sequential commands:

```sh
bun run format:check
bun run typecheck
bun run test
bun run lint
bun run build
INSTABOX_HEADLESS=1 bun run test:e2e
```

The production browser server used `APP_ORIGIN=http://localhost:3100 PDF_NODE_BINARY=/usr/bin/node bun run start --port 3100`. The verifier stopped its server and closed test contexts after completion. Disposable test users were marked and recorded before sign-in; cleanup verified ownership, removed only their own Convex documents, then deleted those users. Tickets, JWTs and cookies stayed in memory, and traces were disabled.

| Command                                   | Result                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| Formatting, types, lint, production build | Passed                                                       |
| Unit tests                                | 50 passed, 321 assertions; one intentional external MCP skip |
| Convex tests                              | 3 passed                                                     |
| Real-service Chromium                     | 11 passed in 4.8 minutes                                     |

Behavior candidate: `47a96ec01e6a79e40a84b689855849436b67db63`. Code digest: `d6d5c8e9c0c5ef9a493eee9018289d90f2cc715dd671c0f568d5842e5710a413`. Documentation-only follow-up commits do not change that digest.

## Behavior exercised

- Real sign-in, initial empty workspace, create/edit/save/reload, revision compare-and-set, account isolation, anonymous rejection, sign-out source clearing, and owner-scoped PDF access.
- All four blank templates compile and parse. The browser asserts blank source before entering fictional data from test fixtures. Actual sandbox compilation, PDF canvas/text extraction, source/PDF downloads, rename/delete and version restore are exercised.
- A freeform instruction calls the real model and produces an exact digest-bound proposal. Accept/reject/undo, factual evidence, stale proposals, late responses, same-resume apply locks, independent undo history and failed compile retention are checked.
- ATS analyzes actual PDF text/geometry. Source search, keyboard/dialog focus, zoom, responsive tab interactions and PDF observer disposal are checked.
- System preference is resolved before paint. Live OS changes, persisted light/dark/system choice, cross-tab changes, invalid preferences and unavailable storage are checked.
- Unit regressions cover exact Unicode selector resolution, ambiguous/missing selectors, overlapping edits, direct range tools, structured Convex errors, finite transport deadlines, caller cancellation, bounded safe recovery and no mutation replay.

## Evidence and diagnostics

The original eight before frames remain under `artifacts/refresh-before/`. The complete after matrix contains 36 PNGs under `artifacts/refresh-after/`: `{1440,768,390}-{light,dark}-{dashboard,templates,source,pdf,assistant,ats}.png`. Each dashboard capture waits for authenticated workspace readiness. The separate `1440-dark-auth-loading.png` is an earlier loading frame and is not dashboard evidence. Workspace test videos are under `test-results/*/video.webm`; the HTML report is `playwright-report/index.html`.

Console errors, page errors, failed requests and every HTTP 4xx/5xx response were attached before navigation. Only already-inflight requests canceled by explicit hard navigation can be classified separately: exact same-origin workspace GET the configured Clerk session-token POST, or the exact Clerk encoded avatar image GET, exact `net::ERR_ABORTED`, and the bounded navigation window. Avatar cancellation additionally requires resource type image and the exact HTTPS img.clerk.com host/default port. HTTP errors, other paths, new-page requests and action failures are never excluded. Classifier regressions reject near misses. Sanitized exclusions are saved separately as `artifacts/navigation-cancellations-*.json`.

Earlier failed gates remain archived. They exposed a localhost middleware self-proxy problem, unreliable model-generated numerical offsets, async control-state mismatches, expected navigation cancellation, a Convex query stall and a real Clerk token transport failure. These failures are not counted as successful verification. The private model-wire adapter now resolves unique exact text against the immutable request snapshot while public range tools, CAS and explicit review remain unchanged. A controlled direct comparison found no evidence for changing connection pooling.

The final run has zero unexpected errors across 8 saved diagnostic reports. Separately recorded explicit-navigation cancellations total 1: `{"navigation-cancellations-all-templates-render.json": 1, "navigation-cancellations-debounced-compile--f.json": 0, "navigation-cancellations-late-assistant--acce.json": 0, "navigation-cancellations-refreshed-light-and-.json": 0, "navigation-cancellations-same-resume-apply-lo.json": 0, "navigation-cancellations-source-edit---save--.json": 0}`. Expected API authentication, tenant and CAS denials are asserted directly. `artifacts/refresh-final-evidence.json` contains SHA-256 hashes for all 44 before/after screenshots and six videos, plus cleanup and preview metadata.

Production read resilience uses separate immutable eight-second query and twenty-second mutation transports. A query can retry once after 100 ms on an own deadline or verified native transport failure; a mutation always runs once. Same-session Clerk token acquisition can retry once only on verified transport failure. Business errors, errors carrying HTTP status and caller cancellation are not retried. Exhaustion returns 503; a write failure explicitly warns that the outcome is unknown and recommends downloading unsaved source before refreshing. An earlier live run demonstrated Clerk recovery in 317 ms and a Convex query recovery in 941 ms, preserving safe first-failure and recovery logs (`artifacts/refresh-gate-e2e.log`). The final successful gate required no recovered upstream failures.

## Preservation and limits

A moved test fixture initially wrote one new test-owned row into the historical SQLite database. After verifying its exact ID, owner, name, timestamp and source, a transaction removed only that row and its two linked revisions. Unrelated row hashes and existing DB/WAL/SHM inodes were preserved. The fixture now uses only an in-memory SQLite database. Details are in `artifacts/refresh-sqlite-cleanup.json` and the logbook.

External authenticated MCP E2E is intentionally skipped because MCP credentials are absent. Core tool and access-control tests remain. Chromium viewport checks do not establish Firefox, Safari or real-device support. ATS remains a disclosed heuristic; PDF-to-source search is approximate. No application was published, merged to main or deployed, and no public ports were created.
