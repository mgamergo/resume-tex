# Overleaf-only editor verification

## Deployment finding

PR #3 merged into `dev` at 2026-11-15 09:37:05 UTC, 15:07:05 IST, as `e1100ce98aeb8cc590ca7a4493057b4b9e21830c`. The remote dev branch contains `c9a2843`. That commit removed the Assistant but explicitly retained ATS.

The live site's JavaScript chunk `/_next/static/chunks/0q5497hi-0oql.js` still contains Assistant and all three old actions. This establishes that the server is delivering an old build. Current compose builds context `.` with `Dockerfile`, copies the source, runs the Next.js build, and packages its `.next` output. It does not pin an obsolete app image.

Current compose requires `MCP_OWNER_CLERK_ID`. Reproducing compose interpolation with exactly the supplied env names and placeholder values fails before building because this setting is missing. The strongest explanation is that the attempted redeploy failed and retained the old container. Dokploy and its logs were not accessed, so that particular failure was inferred rather than observed there.

Read-only `/api/query` probes against the dedicated project's configured cloud Convex endpoint report `workspace:keys`, `workspace:agentRead`, and `workspace:agentCreate` as missing. The first two belong to PR #3. The third is new in this change. PR #3's recorded verification used only a disposable local backend and left the existing deployment untouched. Compose does not deploy Convex. The endpoint comes from the project's development settings; Dokploy's saved URL was not independently read.

## Scope

The app contains the resume library, templates, LaTeX source editor, isolated compile, PDF preview/download, compile log, revisions and MCP key settings. Assistant/provider/proposal runtime code was already removed in PR #3. This change removes ATS controls, scoring, PDF field parsing, job matching and their API/schema/styles/tests. Historical logbook and verification records remain as historical evidence. PDF text extraction now lives only under test fixtures to verify actual compiler output.

MCP adds template discovery, owner-bound template creation and digest/revision checked exact-text patches to its existing read/replace/export/compile/PDF tools. [Connection instructions](agent-tools.md) document clients and the job-listing flow. [Deployment instructions](deployment.md) list the operator's exact environment and Convex steps.

The existing stateless MCP adapter and shared owner-bound store keep all source writes behind the existing atomic compare-and-set. A separate agent data layer would duplicate ownership/history rules. Patches resolve unique, nonoverlapping selectors against one original source and use the same save transaction. No provider code or additional deployment service is needed.

## Verification status

Local format, lint, application/Convex types and six Convex emulator tests pass. The local compiler run failed because this workstation has no system Bubblewrap or `/usr/bin/node`. Its diagnostic logs are retained. Full verification runs in fresh worker `2ce60da9-c795-4828-826c-e0a88ad226b4`, using the existing isolated compiler and project-scoped credentials, a fresh anonymous loopback Convex backend, marked Clerk test identities and one Chromium worker.

The first worker browser attempt failed before launch because its matching Chromium was absent. Only the pinned headless shell was installed. Before screenshots use the immutable pre-change dev source in a separate baseline directory; after screenshots use this change. The live sign-in baseline was also captured separately.

The full gate passed twice, including the final sign-in branding correction: `bun run format:check`, `bun run typecheck`, `bun run lint`, `bun run test` (36 unit tests, 223 assertions and six Convex tests), `bun run build`, and `bun run test:e2e` (11 Chromium cases). The HTTP MCP case produced `artifacts/overleaf-evidence/mcp-job-tailored.pdf` and asserted the fixture keywords in its actual text. Eight saved diagnostic reports have no unexpected errors. The MCP stale-save case expects only its exact HTTP 409 and matching resource console error. Browser cases cover 1440×900, 768×1024, 390×844 and 360px, both themes, all four templates, keyboard compile, history, downloads and bounded PDF canvases. These are Chromium viewport checks, not Firefox/Safari or real-device claims. The production server exits 143 on controlled SIGTERM; the suite and verifier exit 0.

The final full source archive SHA-256 is `1c47bf824447067d33a7b201e32a52b4592086e02a206a66e81b1a5a22b9509a`. A later test-only assertion waits for the dashboard button foreground to settle after theme changes before taking screenshots; its focused run passed with fresh format/types/lint. Both independent Sol passes approved in one round each without findings. Useful screenshot/PDF/log evidence and verified SHA-256 manifests are under ignored `artifacts/before-worker/` and `artifacts/overleaf-evidence/`. The live sign-in baseline is under `artifacts/before/`.

Independent review results are in [the Sol ledger](overleaf-sol-reviews.md). No deployment, Dokploy access, hosted environment change or production data modification is authorized or performed.

All marked test identities were cleaned and the test identity ledger is empty. No app or local Convex test listeners remain. The preserved `keyboard-compile.webm` records the keyboard compile and responsive dashboard flow. Both evidence manifests were independently checked by the UI reviewer.
