# Logbook

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
