# Real-service refresh verification

The refresh uses real Clerk sessions, the deployed private Convex workspace, the configured compatible model, and the isolated TeX compiler. Runtime local stores, model mocks, browser draft recovery, fictional starter content and product mode switches are removed. Historical local documents and browser keys are preserved and are not migrated.

## Candidate and commands

Final candidate, code digest and successful command logs are recorded in `artifacts/refresh-review-gate3-complete.json`. All verification ran in the existing authorized box, checkout `/home/boxes/repos/resume-tex`, with one headless Chromium worker. Bun remains the package manager and build/test runner; Next runs on Node 22.

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
| Real-service Chromium                     | 12 passed in 5.0 minutes                                     |

Behavior candidate: `cb6860c62bd14c7c3515d8558a50ef00121ade58`. Code digest: `e48eb477c80beee1d3c6c4a7eaaf277848e72c7eff9a007e23d1125e4854eb06`. Documentation-only follow-up commits do not change that digest.

## Behavior exercised

- Real sign-in, initial empty workspace, create/edit/save/reload, revision compare-and-set, account isolation, anonymous rejection, sign-out source clearing, and owner-scoped PDF access.
- All four blank templates compile and parse. The browser asserts blank source before entering fictional data from test fixtures. Actual sandbox compilation, PDF canvas/text extraction, source/PDF downloads, rename/delete and version restore are exercised.
- A freeform instruction calls the real model and produces an exact digest-bound proposal. Accept/reject/undo, factual evidence, stale proposals, late responses, same-resume apply locks, independent undo history and failed compile retention are checked.
- ATS analyzes actual PDF text/geometry. Source search, keyboard/dialog focus, zoom, responsive tab interactions and PDF observer disposal are checked.
- System preference is resolved before paint. Live OS changes, persisted light/dark/system choice, cross-tab changes, invalid preferences and unavailable storage are checked.
- Unit regressions cover exact Unicode selector resolution, ambiguous/missing selectors, overlapping edits, direct range tools, structured Convex errors, finite transport deadlines, caller cancellation, bounded safe recovery and no mutation replay.

## Evidence and diagnostics

The original eight before frames remain under `artifacts/refresh-before/`. The complete after matrix contains 36 PNGs under `artifacts/refresh-after/`: `{1440,768,390}-{light,dark}-{dashboard,templates,source,pdf,assistant,ats}.png`. Each dashboard capture waits for authenticated workspace readiness. The separate `1440-dark-auth-loading.png` is an earlier loading frame and is not dashboard evidence. Eight additional correction captures under `artifacts/refresh-review/` cover 360px source/Compile and 1440/768/390px dashboards in both themes. Workspace test videos are under `test-results/*/video.webm`; the HTML report is `playwright-report/index.html`.

Console errors, page errors, failed requests and every HTTP 4xx/5xx response were attached before navigation. Only already-inflight requests canceled by explicit hard navigation can be classified separately: exact same-origin workspace GET, the configured Clerk session-token POST, or the exact Clerk encoded avatar image GET, exact `net::ERR_ABORTED`, and the bounded navigation window. Avatar cancellation additionally requires resource type image and the exact HTTPS img.clerk.com host/default port. HTTP errors, other paths, new-page requests and action failures are never excluded. Classifier regressions reject near misses. Sanitized exclusions are saved separately as `artifacts/navigation-cancellations-*.json`.

Earlier failed gates remain archived. They exposed a localhost middleware self-proxy problem, unreliable model-generated numerical offsets, async control-state mismatches, expected navigation cancellation, a Convex query stall and a real Clerk token transport failure. These failures are not counted as successful verification. The private model-wire adapter now resolves unique exact text against the immutable request snapshot while public range tools, CAS and explicit review remain unchanged. A controlled direct comparison found no evidence for changing connection pooling.

The current run has zero unexpected errors across nine saved diagnostic reports. Two separately recorded cancellations occurred during explicit hard navigation: the already-inflight workspace GET and the exact Clerk avatar image GET, both `net::ERR_ABORTED`. Expected API authentication, tenant and CAS denials are asserted directly. `artifacts/refresh-review-evidence.json` contains SHA-256 hashes for all 52 before/after/correction screenshots and seven videos, plus cleanup and preview metadata. The earlier 44-frame manifest and gate are historical evidence. Current test-owned users and documents were cleaned; the user-requested port-3000 preview remains running, and the test server was stopped.

Production read resilience uses separate immutable eight-second query and twenty-second mutation transports. A query can retry once after 100 ms on an own deadline or verified native transport failure; a mutation always runs once. Same-session Clerk token acquisition can retry once only on verified transport failure. Business errors, errors carrying HTTP status and caller cancellation are not retried. Exhaustion returns 503; a write failure explicitly warns that the outcome is unknown and recommends downloading unsaved source before refreshing. An earlier live run demonstrated Clerk recovery in 317 ms and a Convex query recovery in 941 ms, preserving safe first-failure and recovery logs (`artifacts/refresh-gate-e2e.log`). The current successful gate recovered a Clerk token transport failure in 351 ms and a Convex read reset in 315 ms; both are recorded in `artifacts/refresh-review-gate3-e2e.log`. A prior review gate encountered a write deadline, returned an explicit error and did not replay the mutation; that failed run is not counted as a pass.

## Preservation and limits

A moved test fixture initially wrote one new test-owned row into the historical SQLite database. After verifying its exact ID, owner, name, timestamp and source, a transaction removed only that row and its two linked revisions. Unrelated row hashes and existing DB/WAL/SHM inodes were preserved. The fixture now uses only an in-memory SQLite database. Details are in `artifacts/refresh-sqlite-cleanup.json` and the logbook.

External authenticated MCP E2E is intentionally skipped because MCP credentials are absent. Core tool and access-control tests remain. Chromium viewport checks do not establish Firefox, Safari or real-device support. ATS remains a disclosed heuristic; PDF-to-source search is approximate. No application was published, merged to main or deployed, and no public ports were created.
