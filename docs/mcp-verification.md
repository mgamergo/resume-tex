# Verify the private MCP editor

The implementation removes the in-app Assistant and provider configuration while retaining manual LaTeX editing, PDF preview, history, conflicts and optional ATS analysis. MCP access requires a revocable personal credential. PDF bytes travel directly through authenticated MCP resources.

## Candidate and environment

The final behavior candidate is the source archive with SHA-256 `8216efe853c7b929dd4f9fe7028a32343764d209046bfe6233e2ff0a773a1540`. The controller retains it at `/data/workspace/resume-tex-session/source.tar.gz`. Documentation-only records may follow this candidate. Two later test-only adjustments wait for the dialog theme transition before capture and align the final PDF page for a readable screenshot. The unchanged application passed a focused two-case recheck in 40.7 seconds; local formatting, type checks and lint passed on the final test code.

Tests run on fresh worker `8f614c94-0995-4198-99de-0d5d44413dfb`, in `/home/boxes/repos/resume-tex-mcp`. They use real Clerk sign-in with disposable marked accounts, a fresh anonymous local Convex backend, the actual Bubblewrap/TinyTeX compiler, and the project's pinned Playwright Chromium headless shell. They do not deploy or modify the existing Convex deployment or hosted application.

The verifier removes `AI_API_KEY`, `AI_MODEL` and `AI_BASE_URL` from the test process before building or starting the app. The stdio test process receives only its path, endpoint and MCP credential.

## Commands and coverage

Inject the project's Clerk development configuration into `bun scripts/verify-mcp.ts` after `CONVEX_AGENT_MODE=anonymous bunx convex init` in a fresh checkout. The verifier refuses a non-anonymous or non-loopback Convex configuration, prepares the local owner and issuer, runs the commands below, and stops its local backend. It requires the TeX setup and an existing system Chromium or the matching `bunx playwright install chromium --only-shell` installation.

| Command                | Final outcome                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `bun run format:check` | Passed.                                                        |
| `bun run typecheck`    | Application and Convex projects passed.                        |
| `bun run lint`         | Passed without warnings.                                       |
| `bun run test`         | 45 Bun tests with 290 assertions and five Convex tests passed. |
| `bun run build`        | Production build passed.                                       |
| `bun run test:e2e`     | Final run in progress.                                         |

The ten browser cases cover real sign-in; account ownership and sign-out; theme preference behavior; manual edits, compile failure retention, history restore and source download; optional ATS extraction; four templates at 1440×900, 768×1024 and 390×844 in both themes; 360px keyboard controls; PDF zoom without fetching the artifact again; and a 12-page PDF with bounded visible canvases and disposal after navigation.

The MCP case exercises real HTTP initialize/tools/resources and a stdio initialize/list-tools smoke. It checks missing, forged, cookie-only, foreign-origin and oversized requests; owner-only credential issuance; read/write/export; stale writes; browser adoption and dirty-draft preservation; PDF bytes; short-lived credential expiry without record changes; and revocation denying subsequent tools and PDF reads. Convex tests separately exercise owner binding, hash secrecy, clock-only expiry, revocation, immutable history and atomic CAS.

## Sol correction verification

Functionality review S1 identified a rare batch of large PDF reads that could accumulate a large response. The accepted correction rejects batch messages before dispatch, using the existing streamed 512 KB JSON reader. The correction archive SHA-256 is `94b53545d52b4f33c5370cf3a9c4a117b9973415cd83dbc8c01717134358a412`. Local format, types and lint passed. Two request-body unit tests, a new production build and the complete MCP browser flow passed afterward, including authenticated batch rejection and ordinary PDF retrieval. The focused browser case passed in 28.0 seconds. Evidence is in `batch-request-tests.log`, `batch-build.log`, `batch-e2e.log` and the refreshed `cleanup.json`. UI application code did not change.

## Evidence and diagnostics

Collected evidence lives in ignored `artifacts/mcp-evidence/`. Its `manifest.json` records byte counts and SHA-256 digests verified during transfer. It includes the gate logs, responsive screenshots, masked credential dialogs, decoded `mcp-export.pdf`, PDF rendering-budget observations and browser diagnostics. The collected `pdf-scroll-verification.webm` records the multi-page scroll and disposal flow.

Final cleanup removed every marked test identity; the test app and local Convex listeners stopped. The controller verified all 86 collected evidence files against their SHA-256 manifests, then destroyed only the fresh test worker after preserving source and evidence locally. Playwright records the app server's expected SIGTERM exit as 143 while the suite and verifier exit 0.

The MCP conflict case intentionally records the exact stale manual save's HTTP 409 and its corresponding browser resource message. Other HTTP errors, failed requests, console errors and uncaught exceptions remain failures. Diagnostics attach before navigation. Automatic screenshots, video and traces are disabled in the credential-issuing test; its intentional key screenshots mask the secret.

Earlier failures remain separate from the final result. Anonymous Convex metadata initially failed formatting and is now excluded from Git, Prettier, ESLint and Docker context. A first browser run could not launch `/usr/bin/chromium` on the fresh worker; only the pinned headless shell was installed. The 360px helper initially inspected a hidden PDF before switching tabs; it now opens the PDF tab before asserting rendered content. A later expiry-test formatting failure was corrected before the final gate.

## Limits and handoff

This establishes Chromium viewport behavior, not Firefox, Safari or real-device support. No quantified RAM or latency comparison is claimed. The evidence checks deferred modules, retained documents across zoom, visible-page bitmap limits and offscreen disposal. The MCP endpoint uses configured bearer credentials, without OAuth discovery. Client setup is in [agent tools](agent-tools.md).

Before hosting this revision, deploy its Convex schema/functions and set `MCP_OWNER_CLERK_ID` in both the application and Convex environments. Set `APP_ORIGIN` to the HTTPS origin. The change does not push, deploy, publish ports, change DNS or modify the existing service. The compiler sandbox and deployment-level request protections remain required.

The pstack principles Subtract Before You Add and Prove It Works shaped this change: remove the Assistant/proposal path before adding the smaller MCP boundary, then exercise the actual backend, compiler, transport and browser rather than relying on generated code or screenshots alone. Independent UI and functionality Sol passes approved the final behavior in one UI round and two functionality rounds. S1 is resolved with no open findings; details and usage limits are in [the Sol ledger](mcp-sol-reviews.md).
