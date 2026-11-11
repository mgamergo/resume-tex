# Resume TeX

A LaTeX resume workspace with an editor, real typeset PDF, reviewable editing assistant, version history, and PDF-derived ATS checks. Built with Next.js 16, React, CodeMirror 6, pdf.js, shadcn/ui, Clerk, and Convex. Bun is the supported runtime and package manager.

## Run locally

Requirements: Linux x86-64, Bun 1.4.4, Node.js 22 at `/usr/bin/node`, Bubblewrap with unprivileged user/network/PID namespaces, `prlimit`, `curl`, `tar`, `xz`, `ldd`, and a system font directory. The setup script installs a **user-local** TeX distribution and copies a small runtime root. It does not install system packages. Allow about 1 GB for the toolchain. Unsupported sandboxing fails closed.

```sh
bun install --frozen-lockfile
bun run setup:tex
APP_MODE=local AI_PROVIDER=mock bun run dev
```

Open `http://127.0.0.1:3000`. Local mode is explicit, credential-free, and single-author. SQLite, PDF cache, and history live under `.data`. Bind only to loopback; local mode also rejects non-loopback request hosts. Do not put a reverse proxy or public tunnel in front of local mode.

If system Node is a different version, set `PDF_NODE_BINARY` in `.env.local` to the absolute path of a Node 22 binary. Tests require this variable in the shell environment because Bun does not load `.env.local` in test mode. The TeX setup uses Bash when Dash is unavailable.

```sh
APP_MODE=local AI_PROVIDER=mock bun run build
APP_MODE=local AI_PROVIDER=mock bun run start
```

LaTeX is authoritative. Autosave uses digest **and revision** compare-and-set; edits from other tabs cause a visible conflict rather than overwriting a newer save. Failed saves leave the source and browser draft available. Ctrl/Command+S saves and compiles; Ctrl/Command+K opens the command menu. Undo/redo and find work in the source editor. PDF text is selectable. Double-click-to-source is an explicitly approximate exact-text search, not SyncTeX.

Starter content is fictional. Replace it with your own facts. Choose Jake's Resume, Deedy, AltaCV-style or moderncv; attribution and adaptation details are in [templates](docs/templates.md).

## Connected services

Use `APP_MODE=connected` for Clerk-authenticated Convex storage. The Next.js server validates Clerk sessions and passes the Clerk `convex` JWT to Convex; every query/mutation independently derives the owner from that authenticated identity. There is no cloud-to-local fallback. Follow [cloud setup](docs/cloud-setup.md) for the exact Infisical 0.45.4 command, project ID, Clerk JWT template, and Convex deployment steps. Human account/service keys are required; no unrelated secrets were fetched.

Keep all app credentials in the dedicated Infisical `resume-tex` project. Local examples contain no keys. `NEXT_PUBLIC_*` configuration must be present when building, and connected server settings when starting. The compiler still needs the Linux runtime and writable private `.data` volume in connected mode. This app is intended for a persistent Linux server with Bun, not an edge/serverless compiler deployment.

## Assistant and external agents

Local `AI_PROVIDER=mock` is a clearly labeled deterministic assistant. It can tighten the sample bullet, replace a few weak prefixes, put skills first in a one-column layout, order existing bullets by job language, and repair known LaTeX typos. Unsupported requests return a useful error rather than pretending an LLM ran.

Set `AI_PROVIDER=compatible`, `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY` through Infisical for a real OpenAI-compatible chat-completions provider with structured function calls. HTTPS or loopback HTTP is required. The provider plans one validated structured tool call. All document changes become exact, digest-bound proposals. New numeric evidence and unsupported named skills are rejected; add verified facts to your source before requesting a rewrite. Review the diff for factual accuracy. No model can establish your employment history.

[Agent tools and MCP](docs/agent-tools.md) describe the shared registry, stdio client setup, scope, and tests. MCP can read or propose for one selected resume; approval stays in the UI.

## ATS checks

ATS analysis reads **actual compiled PDF text and coordinates**. It includes What ATS sees, best-effort named contact/experience/education/skills/date fields with raw evidence, geometric column warnings, selectable-text checks, date style/range consistency, word/page count and quantified impact clues. A pasted job description adds BM25-weighted exact, synonym, and suffix-stem coverage with required/preferred context.

The readiness number is a documented heuristic. It is not a proprietary ATS score, ranking guarantee, or hiring probability. [Methodology and weights](docs/ats-methodology.md) and [vendor research](docs/ats-vendor-research.md) explain the evidence and limits.

## Verify

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
APP_MODE=local AI_PROVIDER=mock bun run build
bunx playwright install chromium --only-shell
INSTABOX_HEADLESS=1 bun run test:e2e
```

Playwright starts a loopback production server, uses one Chromium worker, attaches console/page/request/HTTP-error diagnostics before navigation, tests real flows, writes screenshots to ignored `artifacts/`, and stops its server and contexts. It clears only `.data/e2e`, its dedicated test database. Unit tests compile all four templates with the actual isolated toolchain and parse their PDF output. Convex tests exercise authenticated emulator behavior, not live Clerk issuance or a deployed Convex instance. Live connected sign-in and a configured LLM need human keys and remain separate setup verification.

See [compilation policy](docs/compilation.md) for isolation and resource limits. No app hosting, production service changes, or deployment are included.

Final v1 outcomes and limits: [verification](docs/verification.md), [Sol review ledger](docs/sol-reviews.md), and [logbook](logbook.md).
