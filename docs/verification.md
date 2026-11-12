# Historical v1 verification

This record describes the previous local-only test environment. For the current real-service refresh, see `refresh-verification.md`. The old local startup commands below no longer apply.

# V1 verification

The application behavior at `2c2c3951639dc4c10c2c4c88c5e2913c9507092a` passed the complete local verification workflow in the one authorized boxes.dev devbox. The release documentation adds no application behavior. Review outcomes are recorded in [the Sol ledger](sol-reviews.md).

## Commands and results

`bash scripts/verify-local.sh` completed successfully after the final behavior change. It runs these commands sequentially in explicit local/mock mode with one Chromium worker:

| Command                                | Result                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `bun run format:check`                 | Passed                                                       |
| `bun run typecheck`                    | Passed                                                       |
| `bun run test`                         | 34 Bun tests, 208 assertions; 3 Convex emulator tests passed |
| `bun run lint`                         | Passed                                                       |
| `bun run build`                        | Production build passed                                      |
| `INSTABOX_HEADLESS=1 bun run test:e2e` | 5 Chromium cases passed in 54.7 seconds                      |

The tested source was committed with a documentation-only logbook entry. `artifacts/ui-verification-result.json` records its immutable base and verified code-diff digest. Canonical logs are `artifacts/{format,typecheck,unit-tests,lint,build,e2e}.log`. Reports and screenshots are ignored by Git and retained in the preserved box; selected evidence was copied to the controlling workspace with SHA-256 checks.

Seven browser diagnostic reports are empty. Console errors, uncaught page errors with names/stacks, failed requests, and HTTP 4xx/5xx responses are captured before navigation. No browser-error exclusions were added. Playwright's controlled server SIGTERM produces exit 143 in shutdown logs; the verification commands finish with exit 0.

## What was exercised

| Requirement                           | Evidence                                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source editing and actual typesetting | Editor changes appear in actual PDF.js canvas/selectable text; debounce/save compile; invalid compile retains a visibly stale PDF and diagnostics jump to source.                                              |
| Workspace and templates               | All four templates compile and parse; multiple resumes, rename/delete, source/PDF downloads, command menu, immutable history/restore and stale-save/proposal behavior are asserted.                            |
| Compiler boundary                     | Real namespace probe excludes host-private files, inherited sentinel environment and network routes; benign CPU, file, tmpfs and wall limits, cache ownership, scratch cleanup and queue recovery are tested.  |
| Agent and MCP                         | Exact range/digest validation, factual numeric/skill guards, structured compatible-provider HTTP protocol and actual MCP SDK initialize/list/read/propose; browser accept/reject/undo and held-response races. |
| ATS                                   | Actual PDF extraction and geometry, structured fields/date evidence, exact/synonym/stem/BM25 coverage, required/preferred context, missing terms, layout/format/impact warnings and targeted proposals.        |
| Responsive and keyboard use           | Desktop 1440x900, tablet 768x1024, phone 390x844; themes/contrast, zoom, split keyboard resize, history/export, actual phone proposals/ATS results, Find from non-source tabs, dialog focus restoration.       |
| PDF lifecycle                         | Strict diagnostics catch cancellation failures; the final resource assertion observes one PDF resize observer after repeated zoom and zero after leaving the editor.                                           |
| Connected identity                    | Authenticated Convex emulator tests reject anonymous/cross-tenant operations and assert CAS, stale approvals, history bounds and expected exact-range conflict semantics.                                      |

Meaningful failures were investigated, fixed and rerun. Archived evidence includes the initial PDF cancellation trace, search-input event mismatch, and a template assertion that sampled a redraw too early. The final assertions retain their intended resulting-state checks; no tests are skipped.

## Human setup and limits

Live Clerk sign-in/JWT issuance, a deployed Convex backend, and a real external LLM call were not verified without account credentials. Add those settings to the dedicated Infisical `resume-tex` project and follow [cloud setup](cloud-setup.md). Local mode is explicit and does not silently replace a broken connected mode.

V1 supports one LaTeX source file on Linux/Bun. Full bidirectional SyncTeX is unavailable; approximate PDF-text-to-source search and its concrete limits are documented in [compilation](compilation.md). Templates include original adaptations with explicit [provenance](templates.md). ATS scores are disclosed heuristics, not proprietary vendor scores or hiring predictions. OCR, arbitrary upload bundles and realtime character collaboration are outside this v1.

The browser evidence establishes Chromium viewport behavior, not Firefox, Safari or real-device support. No app was published, no main merge was made, and no Dokploy settings or domains were changed.

## Preserved environment

- Private repository: `https://github.com/mgamergo/resume-tex`, branch `dev`.
- Box: `default-box-fork-6bc18ee62f0c` (`0797a779-76a0-4296-b04b-5d61980d9a25`). Preserve it and the `default-box` Template.
- Checkout: `/home/boxes/repos/resume-tex`.
- Run inside the box: `APP_MODE=local AI_PROVIDER=mock bun run dev`. Dependencies and the isolated TeX runtime are installed. For a fresh checkout, follow [the README](../README.md).
