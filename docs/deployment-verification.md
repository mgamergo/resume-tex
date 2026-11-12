# Deployment verification

Verified on 2026-11-12 at <https://resume-tex.buildwithkuro.tech>, inside the Chaitanya Dokploy project. Deployed behavior commit: `8d4058d32a794053be1aca629a24ae1607ceb7cb`. Later documentation commits do not change the deployed behavior.

## Results

- Existing development box `0797a779-76a0-4296-b04b-5d61980d9a25`: formatting, application/Convex typechecks, lint, 55 Bun tests with 337 assertions and 11 Convex tests passed.
- Dokploy built the image from the private repository. The image contains no private build arguments. Its mandatory Bubblewrap startup probe passed under the actual Compose policy: UID 10001, all capabilities dropped and a read-only root filesystem. The container remained healthy with zero restarts. Memory, CPU and process limits were confirmed through container inspection.
- Four real-service Chromium cases passed against the public HTTPS origin in 185 seconds. The final supervisor recorded exit code zero; the reporter recorded passed status and a completed exit hook.
- Coverage includes real Clerk sign-in and private Convex persistence; source editing, compilation, PDF preview and downloads; all four templates; proposal accept/reject/Undo, history and restore; actual PDF-based ATS analysis; and a real model's autonomous edits, policy persistence and Undo.
- Desktop, tablet and mobile controls were exercised. Desktop light, tablet light and phone dark captures were inspected. Three saved diagnostic reports have empty error arrays; the separate sign-in smoke test also asserts no console, page, request or HTTP errors.
- Disposable test accounts and their documents were cleaned. Browser workers exited. No test server was started for the live checks. The existing private development preview and persisted box remain available.

## Commands and evidence

The source checks used `bun run format:check`, `bun run typecheck`, `bun run lint` and `bun run test`. Dokploy executed the `Dockerfile` build through `compose.yaml`, including trusted TeX setup and `bun run build`.

Live checks used the repository's existing tests with an ignored configuration pointing at the public origin and no local web server:

```sh
bunx playwright test \
  --config artifacts/deployment/playwright.config.ts \
  --reporter=./artifacts/deployment/reporter.ts \
  --grep 'source edit → save|all templates render|agent autonomy persists|real Clerk session reaches'
```

`artifacts/deployment-evidence.json` records the image digest, runtime policy, exact cases, completion markers, diagnostic reports and file hashes. Captures are preserved as `artifacts/deployment-desktop.png`, `artifacts/deployment-tablet.png` and `artifacts/deployment-mobile-dark.png`. The artifacts are retained outside Git in the existing box and exported evidence directory.

One Sol round approved the configuration with no findings: gpt-6.1-sol, high reasoning; usage was not returned. Review covered the five-file, 156-line deployment diff. See [Resume TeX Dokploy deployment review](t3-thread://v2/6a1613c6-020e-41b4-82a6-8cbbab25aed4/thread:delegated-task:command%3Amcp%3A60e01cf8-159b-4204-910c-6430adfce727%3Adelegate-task%3Aresume-dokploy-sol-r1-20261112-8d4058d). Documentation-only follow-up does not alter that configuration.

## Earlier failures and limits

Retained runs distinguish two hostname-resolution failures, a supervisor pipe failure after four reported passes, and a later upstream Clerk connection failure followed by explicit interruption. None substitutes for the final completed gate. Logging now filters session headers before writing reporter output. Expired disposable-session cookies appeared while inspecting the first failed transport log; those accounts were deleted and retained text logs were redacted. No application API keys were exposed.

This deployment uses the existing development Clerk/Convex configuration from Infisical. Production configuration was empty, and Infisical updates are not automatically synchronized to Dokploy. See [deployment settings](deployment.md). External MCP, Firefox, Safari and real devices were not retested for this deployment. Chromium viewport checks establish only the tested Chromium behavior.
