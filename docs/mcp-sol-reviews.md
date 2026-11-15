# MCP editor Sol reviews

The user requested separate UI and functionality sol-loop passes. Both review the change against `960dfd52d1167a77b568b94afc0e8d387faf6bdf`, the merge base with the repository's remote default branch, `origin/dev`.

The UI pass covers the source/PDF workspace, responsive controls, key dialog, accessibility, PDF lifecycle and browser evidence. The functionality pass covers credential authorization, ownership, source CAS, exports, PDF resources, removal of provider requirements and implementation/test callers. Deployment and unrelated legacy history are outside scope.

Each pass uses one Sol reviewer. The default budget is three rounds per pass. Reviews do not edit files or start delegates. No push is authorized.

| Pass          | Round | Provider / model / effort  | Verdict | Findings                     | Usage        |
| ------------- | ----- | -------------------------- | ------- | ---------------------------- | ------------ |
| UI            | 1     | codex / gpt-6.1-sol / high | APPROVE | None                         | Not returned |
| Functionality | 1     | codex / gpt-6.1-sol / high | APPROVE | S1, nit, accepted            | Not returned |
| Functionality | 2     | codex / gpt-6.1-sol / high | APPROVE | S1 resolved; no new findings | Not returned |

## Finding ledger

UI round 1 approved the current UI behavior with no findings. No UI fixes, disagreements or declined findings. UI diff size was 10 files, 1,026 insertions and 2,478 deletions. Its application behavior remains unchanged by the functionality correction.

Functionality round 1 found no blockers or should findings. S1, a nit at `app/api/mcp/route.ts:21`, noted that the SDK accepts up to 100 batched requests and could accumulate many large PDF resources. The parent accepted it because RAM use is central to this task. The smallest correction parses the existing bounded JSON body, rejects arrays before dispatch and passes the parsed single message to the SDK. An authenticated two-message regression expects HTTP 400; ordinary MCP operations remain in the same test. No aggregate budget, queue or session state was added. The correction passed local formatting, application/Convex types and lint; two bounded-request unit tests; a fresh production build; and the full MCP browser flow with batch rejection, expiry, revocation and PDF bytes. The browser recheck passed in 28.0 seconds. Round 2 reviewed only S1 and this changed code, confirmed S1 resolved and approved with no new findings.

Before review, the parent audit changed MCP reads to fresh Convex transactions so time-based credentials do not depend on cached query results. The gate includes clock-only expiry and actual short-lived HTTP credentials. This is not a reviewer finding.

UI review diff command: `git diff 960dfd52d1167a77b568b94afc0e8d387faf6bdf -- components app/globals.css tests/e2e`.

Functionality review diff command: `git diff 960dfd52d1167a77b568b94afc0e8d387faf6bdf -- . ':!logbook.md' ':!docs/mcp-sol-reviews.md' ':!docs/mcp-verification.md'`. Before round 1, this scope was 52 files, 2,221 insertions and 4,823 deletions. The final scope is 52 files, 2,235 insertions and 4,823 deletions. No findings have been declined or disputed.

[Sol loop UI review](t3-thread://v2/6a1613c6-020e-41b4-82a6-8cbbab25aed4/thread:delegated-task:command%3Amcp%3Aaf0e47ab-1c87-443d-9497-1414e3bed6ed%3Adelegate-task%3Amcp-ui-sol-round1-20261115) approved the UI in one round.

[Sol loop functionality review](t3-thread://v2/6a1613c6-020e-41b4-82a6-8cbbab25aed4/thread:delegated-task:command%3Amcp%3Aaf0e47ab-1c87-443d-9497-1414e3bed6ed%3Adelegate-task%3Amcp-function-sol-round1-20261115) approved round 1 with S1 above.

After the smallest S1 correction, the full review scope is 52 files, 2,235 insertions and 4,823 deletions. The 14 added lines implement the single-message guard, its regression and one setup sentence. No new lock, queue, session registry or budget mechanism was added.

[Sol functionality recheck](t3-thread://v2/6a1613c6-020e-41b4-82a6-8cbbab25aed4/thread:delegated-task:command%3Amcp%3Aaf0e47ab-1c87-443d-9497-1414e3bed6ed%3Adelegate-task%3Amcp-function-sol-round2-20261115) approved the corrected behavior. Both requested passes are complete: one UI round and two functionality rounds with gpt-6.1-sol, with high reasoning exposed in the delegation settings. Token usage was not returned. Sol caused the single-message RAM guard; no blocker, should, declined or disputed finding remains. No push or deployment was performed.
