# Logbook

## 2026-11-15 — Private MCP agent editing

Removed the in-app Assistant, provider adapter, proposal APIs/state and AI environment requirements. Manual LaTeX/PDF editing, history, conflict recovery and optional ATS remain. Revocable hashed 90-day keys are issued only to MCP_OWNER_CLERK_ID, configured in both app and Convex. Stateless HTTP MCP and a key-only stdio bridge support read/write, source export and authenticated binary PDF resources without public storage. Agent reads use fresh transactions to avoid time-stale authorization caches; saves retain atomic digest/revision CAS.

Editor/PDF modules load on demand. PDF documents persist across zoom; visible pages have bounded bitmaps and offscreen pages release rendering resources. Hidden tabs stop document polling. Fresh isolated Clerk/local-Convex/TeX verification and the separately requested UI/functionality Sol reviews are recorded in docs/mcp-verification.md and docs/mcp-sol-reviews.md. Formatting, app/Convex types, lint, 45 Bun tests/290 assertions, five Convex tests, build and ten Chromium cases passed without provider variables. UI Sol approved in one round; functionality Sol approved in two, resolving one batch-response RAM nit with a single-message guard and passing focused checks. Test services and marked identities are cleaned; the fresh test worker was destroyed after verified local evidence/source export. Existing deployment untouched. No deployment or push was performed.

## 2026-11-12 — Dokploy deployment verified

Deployed reviewed behavior 8d4058d to https://resume-tex.buildwithkuro.tech as resume-tex in the existing Chaitanya project. Private dev source, automatic deploy disabled, allowlisted development Infisical settings, DNS and valid Let's Encrypt HTTPS. The actual nonroot/cap-drop container passed its sandbox probe and remains healthy. Format/types/lint, 55 Bun tests/337 assertions and 11 Convex tests pass; four live Chromium cases completed with exit0, three empty diagnostic reports and cleaned test identities. Earlier DNS/Clerk and supervisor failures remain separate, with session output redacted. One Sol round approved without findings. Evidence and limits: docs/deployment-verification.md. This follow-up changes documentation only; preserve the same box and existing preview.

## 2026-11-12 — Dokploy deployment preparation

Authorized deployment targets the existing Chaitanya project and resume-tex.buildwithkuro.tech. Added a nonroot Node 22/Bun image with trusted TeX provisioning, public-only build arguments, explicit runtime settings and persistent PDF cache. Compose retains Bubblewrap isolation without host capabilities or privileged mode. A server probe demonstrated nested namespaces need service-scoped seccomp/AppArmor options and systempaths=unconfined; the default masked proc mount failed. Actual image compilation and live verification remain pending. Production Infisical is empty, so this deployment uses the existing development service configuration. Existing unrelated services and the same devbox are preserved.

## 2026-11-12 — Autonomy PR opened

Opened https://github.com/mgamergo/resume-tex/pull/2 from dev to main for per-resume autonomous agent editing. Dev includes the current main without conflicts. The PR records the separate baseline and correction checks and the two-round Sol approval. This commit updates project memory only. Repository remains private; the same box and preview are preserved.

## 2026-11-12 — Autonomy Sol approval

Sol round 2 approved clean `585f1e1`: both deletion findings resolved, no new findings. Two rounds used gpt-6.1-sol on high reasoning; usage was not returned. The tested behavior remains `aa8827b`, with baseline full 16-case and final focused correction evidence kept separate. This record changes documentation only. Push to dev follows; the same box and private preview remain running.

## 2026-11-12 — Sol deletion corrections

Sol round 1 found retained conflict state after deletion (S1, should) and a related retained apply lock (S2, nit). Four successful-deletion cleanup statements address both. Clean behavior `aa8827b` passed fresh formatting, types, lint, build, 55 Bun tests/337 assertions, 11 Convex tests and a real-service conflict/delete/create plus held-accept/delete/create regression. Baseline full 16-case results remain separate. Current diagnostics are empty and test resources cleaned. Ledger: docs/agent-autonomy-sol-review.md. Fresh scoped recheck follows before push.

## 2026-11-12 — Autonomy verified

Development functions deployed to the existing Convex deployment using the securely supplied matching dev key. Clean behavior head `4906819` passed formatting, application/Convex types, lint, build, 55 Bun tests/337 assertions, 11 Convex tests and 16 real-service Chromium cases, including actual stdio MCP. Fixed delayed navigation locks and typing during save; retained failed logs and narrowed a test fixture to exclude a measured box HEAD probe. Current diagnostics are empty, test identities are cleaned and the private preview remains running in the same box. Evidence: artifacts/autonomy-evidence.json. Sol review follows before push.

## 2026-11-12 — Per-resume agent autonomy

Selected architecture B: a separate owner-scoped permission record and one atomic proposal/application path shared by HTTP and MCP. Review remains default; policy-version checks prevent in-flight requests gaining authority after a setting change. Added a persistent Assistant control and source reconciliation that preserves dirty drafts. Types, lint, 55 Bun tests/337 assertions and 11 Convex tests pass. Live deployment/browser verification follows; the existing preview and same persisted box are preserved.

## 2026-11-12 — PR opened

Opened https://github.com/mgamergo/resume-tex/pull/1 from dev to main. GitHub reports MERGEABLE/CLEAN with no conflicts. Preserved the old dev tip at backup/dev-before-main-rebase-20261112 and pushed the rebase with an exact lease. Repository remains private; main is unchanged. Verification and cleanup are recorded below. The existing box and private preview remain running.

## 2026-11-12 — Rebased PR verified

Combined candidate `b8ec52a600bf42ccf3f082ac6872628454f92bc5` passed trusted TeX setup, shell syntax, formatting, application/Convex typechecks, lint, build, 50 Bun tests/321 assertions, three Convex tests and 12 real-service Chromium cases in 4.9 minutes. An actual sandbox compile and PDF text extraction also passed with fullpage, Babel English and titlesec together. Nine diagnostic arrays are empty; two exact in-flight navigation cancellations remain separately recorded. Test users/documents were cleaned, test3100 stopped, and the existing box keeps the private preview. Marker and immutable captures are indexed in artifacts/pr-main-sync-evidence.json. The final documentation-only record does not change the tested digest.

## 2026-11-12 — Prepare dev-to-main PR

Rebased dev onto main `1906be0` and resolved the three conflicts. Kept real-service-only environment examples, both branches' history, Babel English/fullpage provisioning, repeatable shell setup, the configurable Node PDF worker with its existing main-branch limit, and the separate Convex typecheck. Preserved the pre-rebase dev tip in a backup ref. Full verification follows on the combined tree before the authorized dev update and PR creation. No merge into main or deployment is authorized.

## 2026-11-11 — Refresh Sol approval

The second UI/UX Sol round approved clean `f63eabf`: S1 and S2 resolved, Escape handling accepted, no new findings. The reviewer verified all eight correction screenshots against the evidence manifest and read the passing logs; it ran no suites or browsers. Two rounds used gpt-6.1-sol on high reasoning; usage was not returned. The tested behavior remains `cb6860c` with the recorded digest. This final change records approval only. The same box and private port-3000 preview remain in use; external MCP is intentionally unverified.

## 2026-11-11 — UI corrections verified

Candidate `cb6860c62bd14c7c3515d8558a50ef00121ade58` passed the focused repeated 360px keyboard check and the full gate: formatting, types, lint, build, 50 Bun tests/321 assertions, three Convex tests and 12 real-service Chromium cases. Nine diagnostic reports are empty; two exact in-flight navigation cancellations are saved separately. The evidence manifest covers 52 screenshots and seven videos. Test-owned users/documents and the test server are cleaned. The same box retains the live port-3000 preview. Sol round 2 will check the open findings and changed code; no push occurs during that review.

## 2026-11-11 — Dialog key trace

The first Escape fallback was insufficient. A focused browser trace showed Escape reaching the search input, becoming default-prevented and leaving the dialog open. The application dialog now handles Escape explicitly even when the underlying layer marks it prevented. Existing close/focus assertions remain; a focused repeated check must pass before another complete browser run. Temporary diagnostic test code was removed, while its ignored key trace and failed logs remain.

## 2026-11-11 — Immediate dialog Escape

The full review recheck exposed a real early-Escape race after command input autofocus, plus a separate upstream Convex write deadline. Added a narrow dialog-content keyboard fallback that respects already-handled events and retains the existing focus-return path. Repeated keyboard open/Escape/focus assertions now cover 360px in both themes. No writes are replayed after transport failure. The failed gate remains archived; a fresh complete gate follows.

## 2026-11-11 — UI review corrections

Sol round 1 found an unnamed Compile action at widths up to 360px and an ordering claim in the library heading. The compact action now has an explicit state-aware accessible name, and the heading reads “Resumes.” A real-service 360px regression checks both themes, header bounds, keyboard-triggered compilation and actual PDF rendering. Verification and the focused Sol recheck are recorded in `docs/refresh-sol-reviews.md`.

## 2026-11-11 — Real-service refresh verified

- Removed runtime local/mock/demo paths and browser draft persistence. Real Clerk/Convex ownership gates the workspace; only a configured compatible model is available. Four blank layouts preserve their engines/macros/fonts, including the sandbox fullpage dependency. Historical local documents and browser keys remain preserved and are not migrated.
- Refreshed neutral light/near-black UI with blue accents and concise copy. A prepaint system/light/dark preference follows live OS changes and works without storage. Source/PDF focus, dialogs, async apply locks, editor isolation and PDF disposal are retained.
- Real verification exposed strict-save field leakage and unreliable model offsets. Route projection and unique immutable exact-text selectors fix them while preserving public ranges, digest/CAS, tenant ownership and explicit review. Read transport has bounded safe recovery; writes never replay and report unknown outcome. No pooling changes were justified by real bounded comparisons.
- Complete candidate 47a96ec passed format/types/lint/build, 50 Bun tests/321 assertions, three Convex tests and all 11 real-service Chromium cases (4.8 minutes). One external authenticated MCP case is intentionally skipped because credentials are absent. All eight saved diagnostic reports are empty; narrow explicit-navigation cancellations are recorded separately. The final marker/digest, 44 before/after frames and six videos are indexed in artifacts/refresh-final-evidence.json and docs/refresh-verification.md. Earlier failed/interrupted runs remain retained.
- A moved test fixture initially added one test-owned SQLite row (2e790de2-0fe0-4d1b-a94b-1de48fd98260). Authorized exact-match cleanup removed only that row and its two revisions; unrelated row hashes and DB/WAL/SHM inodes are unchanged. The fixture now uses memory only. Evidence: artifacts/refresh-sqlite-cleanup.json. Real test users/documents were cleaned; test3100 is stopped. The authorized private real-service preview remains on3000.
- Next: parent independent Sol review. No app publishing, main merge, Dokploy change or public port was performed. See docs/refresh-verification.md for commands, screenshots and Chromium/MCP limits.

Earlier entries describe historical versions; their local-mode commands no longer apply.

## 2026-11-11 — Babel English for imported resumes

- Provision `babel-english`, the separate TeX Live package supplying english.ldf; installed locally and refreshed toolchain manifests. Preserve existing source language settings instead of removing Babel. Other languages still require explicit provisioning.
- Sandboxed pdfLaTeX produced a one-page PDF with all packages shown in the reported preamble, including fullpage and Babel English. All eight core tests (80 assertions), ESLint and shell syntax checks pass. Configuration-only fix; no UI changes or Sol loop needed.

## 2026-11-11 — Imported resume fullpage support

- Added TeX Live `preprint` to trusted setup; CTAN confirms it supplies `fullpage.sty`. Keeping the original package preserves imported resume margins instead of rewriting source. Runtime remains offline; other unprovisioned packages may still need explicit setup additions.
- Re-ran local TeX setup and refreshed ignored toolchain manifests. A sandboxed pdfLaTeX document using fullpage[empty] and titlesec produced a one-page PDF successfully. All eight core tests (80 assertions), ESLint and shell syntax checks pass. Configuration-only change; no UI changes or Sol loop required.

## 2026-11-11 — Convex development typecheck

- Reproduced TS2591 in auth.config.ts with Convex's separate TypeScript project. Track convex/tsconfig.json with explicit existing Node types so process.env resolves under TypeScript 6; no dependency or runtime changes.
- Added the Convex project to the standard typecheck command. Ignore generated Convex bindings in Git and ESLint; preserve the local generated files.
- Application and Convex typechecks, lint, formatting of changed config files, and all three Convex emulator tests pass. Configuration-only fix; no UI changes or Sol review needed. User requested committing local setup plus this fix and pushing main; remote previously had only dev.

## 2026-11-11 — Local workstation setup

- Cloned origin/dev and created chore/local-setup. Installed frozen Bun dependencies, TinyTeX, Chromium, and repository-local Node 22.23.4. Ignored .env.local selects local/mock mode and PDF_NODE_BINARY. No system files or connected services changed.
- Made the TeX setup tolerate missing Dash and replace its read-only compiler runner on repeated setup. PDF_NODE_BINARY overrides the default /usr/bin/node. Raised the PDF worker virtual-address limit to 4 GiB after both system Node 26 and local Node 22 exhausted the 2 GiB limit on this workstation. The 128 MiB heap and CPU/deadline limits remain unchanged.
- Build, lint, formatting, 34 unit tests with 208 assertions, and three Convex emulator tests pass. All five Chromium workflows pass in 39.5 seconds; inspected artifacts/editor-desktop.png confirms the editor and actual PDF preview render. Run bun run dev and open http://127.0.0.1:3000. For tests, export PDF_NODE_BINARY="$PWD/.tools/node22/node_modules/node-linux-x64/bin/node" before bun run test.

## 2026-11-11 — V1 reviews approved and handoff

- Functionality sol-loop approved in two rounds; UI/UX sol-loop approved in three at 2c2c395. All F1–F6 and U1–U3 are resolved, with no declined or disputed findings. Reviewer provider/model/effort: codex/gpt-6.1-sol/high; usage was not exposed. docs/sol-reviews.md records findings, outcomes and diff sizes.
- Latest complete verification passed formatting, types, lint, production build, 34 Bun tests/208 assertions, three Convex emulator tests and five Chromium cases (54.7 seconds), with seven empty diagnostic reports. Source/PDF, actual phone proposals/ATS, keyboard focus, lifecycle counts, ownership/CAS, MCP and sandbox/resource evidence are documented in docs/verification.md. Desktop, tablet and phone screenshots were inspected and posted inline.
- This final commit adds documentation only. Code-diff hashes match the verified run. Private dev is the handoff branch; no main merge, app publishing or Dokploy changes. Preserve session box 0797a779-76a0-4296-b04b-5d61980d9a25 and default-box.
- Human setup remains for Clerk, a Convex development deployment and real model settings in the dedicated Infisical resume-tex project. Live service credentials were not fabricated or fetched from unrelated projects. Full SyncTeX, arbitrary uploaded bundles, OCR and realtime character collaboration remain the explicit v1 limits.

## 2026-11-11 — Final PDF observer correction

- UI Sol round 2 resolved U1/U2 and requested one remaining U3 guard after the awaited initial draw. Added the disposal check before observer construction so teardown cannot attach a late observer. Browser instrumentation keeps native observer behavior and asserts one PDF observer after repeated zoom, zero after leaving the editor.
- A transient boxes control disconnect did not stop the original test process; its PID/logs were reconciled without duplicate runs. That run found a pre-existing eager template-text assertion racing a legitimate redraw. Replaced it with a retrying assertion for the same TypeScript text. The failed report remains archived.
- The next complete scripts/verify-local.sh run passed all format/type/lint/unit/Convex/build/browser checks: 34 Bun tests/208 assertions, three Convex tests and five Chromium cases. All seven diagnostic reports are empty. Current behavior awaits UI Sol round 3; no push during the UI loop.

## 2026-11-11 — UI review corrections and PDF cancellation

- Accepted U1/U2 from UI Sol round 1: command Find now reveals source and focuses search after dialog closure; dialogs retain and restore their opener while Find gets its destination focus. Keyboard assertions cover PDF/Assistant/ATS origins, search matches, Escape and rename/command focus at 768px and 390px.
- The initial match assertion used Playwright fill, while installed CodeMirror commits on keyup/change. Normal typed input fixed the test action and retained the highlight assertion. Its trace is preserved. A later strict diagnostic found an actual RenderingCancelledException from an observer redraw during PDF teardown. Added the missing redraw error boundary and a disposed-import guard; active rendering failures remain visible, teardown cancellations are handled. Diagnostics now include error name and stack. No exclusions were added.
- Full scripts/verify-local.sh passed after these changes: format, types, lint, build, 34 Bun tests/208 assertions, three Convex emulator tests, five production Chromium cases. All seven diagnostic reports are empty. Existing phone, zoom, source-session and proposal flows exercise the PDF lifecycle. Code awaits UI Sol recheck; no push during this loop.

## 2026-11-11 — Functionality approved and phone workflows checked

- Functionality Sol round 2 approved all six findings at 734f066, with no findings open. The approved commit was pushed to private dev and its remote SHA verified. Model: codex gpt-6.1-sol, high reasoning effort; usage was not exposed.
- Added browser-only evidence at 390px for reviewing and accepting an actual proposal, reading its updated PDF, and scoring a real PDF against a job description with a missing skill. The targeted five-workflow case passed; typecheck and lint passed. Application behavior is unchanged. Separate UI/UX Sol review follows on the current tested source.

## 2026-11-11 — Functionality Sol corrections

- Sol round 1 found six concrete issues. Created generated public assets on fresh checkout; locked source/engine/undo during accept and restore before awaiting; keyed editor history by resume; normalized terminal keyword punctuation; used token boundaries for skill claims and evidence; preserved exact-range conflict semantics across Convex. All findings accepted and corrected with focused regression coverage.
- The new browser case holds real accept/restore responses, attempts typing, checks stored source and unlock, then creates Deedy through the command menu and verifies Undo cannot restore another resume's private content. Its first run exposed a test expectation that ignored Deedy's surname macro; corrected that source assertion without removing the private-content check. Four existing browser cases passed on that run.
- Full verification after corrections passed: formatting, types, lint, production build, 34 Bun tests/208 assertions, three Convex emulator tests, five production Chromium cases (45.8 seconds). All seven browser diagnostic arrays are empty. The generated public directory is tested from a fresh temporary working directory.
- Current behavior awaits functionality Sol recheck, then the separate UI/UX pass. No push during the review loop. Live account/model setup remains unverified and documented.

## 2026-11-11 — Independent verification and final corrections

- Parent accepted exclusive ownership at pushed fc1dfea. An independent full driver passed format, lint, types, build, 31 Bun tests/185 assertions, two Convex emulator tests and all four production Chromium cases; mobile history and source-download controls were exercised at 768/390 widths. Diagnostics remained empty.
- Two concrete regressions were reproduced before correction: hyphenated preferred headings were marked required, and narrow layouts hid the only entry to history/source export. Normalized heading separators/plurals and restored the command button on narrow screens, with unit/browser regression coverage.
- The preferred-heading regression also exposed heading words entering the missing-keyword list. Recognized delimiters now only change requirement context and do not become scored terms. All eight ATS unit cases pass with 40 assertions after the fix.
- SyncTeX's concrete missing pipeline/query/hit-testing pieces and unavailable source-to-PDF direction are now documented. Approximate PDF text-to-source remains available.
- Read-only comment audit covered 61 source files, found no suppressions or actionable comments, and retained actual bundler directives. No comment edits or holds.
- Next: full verification on this committed correction, then functionality and UI/UX sol-loop passes. Live Clerk/Convex issuance and real LLM credentials remain human setup in the dedicated Infisical project.

## 2026-11-11 — Complete v1 workspace and verification

- Added the document dashboard/gallery, shadcn controls, LaTeX CodeMirror editor with macro completion/undo/find/diagnostics, resizable PDF split with actual canvas/selectable text, command menu, persisted theme, responsive tabs, source/PDF downloads, rename/delete and version restore. Four distinct template adaptations compile through the isolated runtime.
- Added inline proposal review and exact highlights, accept/reject/undo, targeted ATS heading/column fixes and explicit author-evidence proposals. Fixed async document-session races with held real responses, monotonic proposal reconciliation, and source/engine/revision/JD freshness. A real tailoring test caught and fixed preamble macros being mistaken for bullets.
- Fixed observed production origin normalization, PDF parser bundling/startup behavior, focus outlines/CTA color, dark syntax contrast and mobile zoom reachability. PDF worker failures now retain bounded sanitized diagnostics with code/signal. No live model or account result is fabricated.
- Final `scripts/verify-local.sh` result is 0. `bun run format:check`, `lint`, `typecheck`, `test`, `build` and production `test:e2e` pass. Bun has 28 passing tests / 179 assertions; Convex emulator has 2 passing tests; Playwright has 4 passing Chromium flows with one worker. Every browser diagnostic list is empty, with no exclusions. Controlled server SIGTERM exits 143 in its shutdown log and the test command exits 0.
- Browser evidence covers 1440x900, 768x1024, 390x844, dark/light, PDF zoom, agent diffs, actual ATS score/text, invalid compile retention, evidence insertion and cross-resume races. Screenshots were downloaded with digest checks and visually inspected. Authoritative reports are under ignored artifacts/; stale hidden reports are archived under artifacts/history/.
- Human setup remains for real Clerk/Convex and LLM keys through the dedicated Infisical project. Actual MCP stdio and provider HTTP protocol were tested locally; Convex identity tests are emulator evidence, not a live account claim. V1 is a single-file Linux/Bun workspace; SyncTeX is replaced by explicitly approximate PDF text search. No publishing, merges or production service changes.
- Parent owns the independent review and two Sol-loop passes after implementation handoff.

## 2026-11-11 — Assistant, PDF analysis and connected storage

- Structured tools are shared by HTTP assistant and authenticated stdio MCP. Provider requests bind to the pre-request source digest; clients also supply their base digest. Exact range limits reject full rewrites. New numeric/known-skill claims require existing source or explicit author evidence. UI approval remains separate from MCP.
- Real OpenAI-compatible HTTP function-call adapter has a loopback protocol fixture. Offline mode is explicitly deterministic. MCP SDK initialize/list/read/propose and stale-base tests pass.
- ATS now parses actual compiled PDF text/geometry, named fields with evidence/confidence, multiple degrees, date styles/reversed ranges, heading-scoped JD requirements, synonym/stem matches and BM25 weights. Source hints remain separately labeled. Vendor/Workday limits and all score weights are documented.
- PDF parsing runs in a clean-env, deadline/CPU/address-space/heap/output-limited Node worker. Regular temporary descriptors avoid a Bun/Node pipe failure observed in tests. All temporary input/output/log files are bounded and removed. Compiler resource probes demonstrate kernel tmpfs/file bounds, CPU termination, deadline cleanup and queue recovery.
- Convex list/history use indexed small summaries and lazy single-version source reads. Delete schedules bounded private cleanup. Expected auth/not-found/CAS/stale errors carry validated ConvexError status data, preserving HTTP semantics. Emulator identity/CAS/history tests are distinct from live Clerk verification.
- `bun run typecheck` and `bun run lint` pass. Current `bun run test` passes 27 Bun tests / 173 assertions plus 2 Convex emulator tests. Main production browser workflow and responsive/template flow pass; extra race/failure cases are being stabilized. Live Clerk/Convex deployment and live LLM verification remain human-key setup.

## 2026-11-11 — Verified core checkpoint

- Added immutable SQLite revisions, digest+revision CAS, owner-scoped Convex functions and exact proposal review. Source remains authoritative.
- Actual Bubblewrap compiler has curated copied ELF libraries, readonly TinyTeX, 32 MiB work and 16 MiB temp tmpfs, network/PID/user isolation, clean environment, fixed no-shell-escape argv, CPU/AS/process/file/wall bounds and bounded pipes/cache/queue. No host fallback.
- TinyTeX v2026.11 archive SHA verified. Fixed observed .TinyTeX directory, lm package name and moderncv fontawesome6 dependency. Package/runtime manifest participates in cache identity.
- `bun run typecheck` passes. `bun test tests/unit/core.test.ts` passes 8 tests / 64 assertions, including actual compilation and PDF extraction of all four templates, owner isolation, CAS/restore, proposals and real sandbox probe. Initial logging-only smoke did not establish success; moderncv failed and was fixed before the asserted run.
- Next: UI, richer ATS/parser fixtures, connected identity tests, production build and browser flows. Cloud service keys remain human setup.

## 2026-11-11 — Architecture and environment

- Private repository: `mgamergo/resume-tex`; branch `dev`. No merges or publishing authorized.
- Exactly one fresh box from default-box: `default-box-fork-6bc18ee62f0c`, ID `0797a779-76a0-4296-b04b-5d61980d9a25`, creation operation `qd7kf1t3tcgch2ma2qqqb3wj898j09zz`. Preserve this box and default-box. All generation, builds, and tests run here, checkout `/home/boxes/repos/resume-tex`.
- Read upstream private `mgamergo/skills/AGENTS.md` through authenticated GitHub API. Local instructions retained in AGENTS.md. Greenfield has no main history to rebase onto. Start directly on dev; initial design commit is review base.
- Two independent Sol/Astra design candidates agree: LaTeX is authoritative; immutable revisions; compare-and-set saves; revision-bound reviewable proposals; PDF-derived ATS. A canonical JSON resume model was rejected because arbitrary LaTeX cannot round-trip faithfully. Synthesis adopts this consensus; no distinct competing implementation to graft.
- Choose pinned TeX Live (user-local TinyTeX distribution) for Jake, XeTeX Deedy, AltaCV-style and moderncv compatibility. Tectonic is compact and supports untrusted/cached-only modes but needs a complete offline bundle and has a narrower engine profile. Browser SwiftLaTeX/busytex improves privacy but adds package/font downloads and a second compatibility/resource surface. See docs/compilation.md for sources and enforced policy.
- Bubblewrap namespace probe passed on this box, including unshared network. Docker is absent. Use Bubblewrap with an immutable curated compiler root, scratch-only writes, fixed engine/flags, no shell escape, clean environment, kernel resource limits, bounded wall time and output, one worker and content cache. Compilation must fail closed if isolation is unavailable. Never run untrusted TeX directly on the host.
- App: Next.js, shadcn/ui, Bun, Clerk/Convex connected mode; explicit local workspace mode with SQLite and deterministic mock AI for offline use. Cloud misconfiguration must never silently fall back to local mode.
- Agent/MCP: one validated structured edit registry; exact ranges with expected text, source digest, stale-edit rejection, review/accept/reject/undo. External MCP clients propose edits, UI approves. No arbitrary filesystem or command tools.
- ATS: extract real PDF text and geometry; explainable lexical/skill matching with required/preferred weights and BM25, section/contact/date/impact/length checks. Findings are heuristic evidence, not proprietary ATS predictions or hiring probabilities. Sources include Greenhouse/Lever parsing docs, Oracle Taleo docs, Jobscan and Resume Worded guidance. Workday internals require explicit uncertainty.
- UX: document-first, cool gray chrome (#f3f5f8), ink (#202a3a), blue (#315fea), border (#dce2eb), muted text (#657186), white paper. Sans UI and monospace source; deliberate editor/PDF pairing, collapsible agent/ATS panels; narrow-screen tabs. Accessible focus and reduced motion.
- Throughput checkpoint: blocking gates are sandbox and Git transport; one coupled implementation owner works on exclusive dev branch inside this box. Independent research remains on workstation only. Parent does not write or run suites while owner holds checkout. No additional devboxes or browser workers.
- Inherited box GitHub App token cannot see this new repo. Existing workstation gh authentication is used only as a transient stdin Git credential through dvb exec; no credential values are printed, persisted, or committed.
