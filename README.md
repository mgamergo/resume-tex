# Resume TeX

A LaTeX resume workspace with a source editor, compiled PDF, reviewable assistant, version history, and PDF-derived ATS checks. Bun is the supported runtime and package manager.

## Setup

Requirements: Linux x86-64, Bun 1.4.4, Node.js 22 at `/usr/bin/node`, Bubblewrap with unprivileged namespaces, `prlimit`, `curl`, `tar`, `xz`, `ldd`, and system fonts. The setup script installs user-local TinyTeX and a sandbox runtime; it does not install system packages.

```sh
bun install --frozen-lockfile
bun run setup:tex
```

Configure Clerk, Convex, and an OpenAI-compatible model in the dedicated Infisical project. See [cloud setup](docs/cloud-setup.md) and [.env.example](.env.example). Build and run with the same injected public configuration:

```sh
infisical secrets-manager run \
  --domain=https://secrets.buildwithkuro.tech \
  --projectId=35ecfc68-85d2-470c-9cb9-4ab8929cc03b \
  --env=dev --path=/ -- bun run build

infisical secrets-manager run \
  --domain=https://secrets.buildwithkuro.tech \
  --projectId=35ecfc68-85d2-470c-9cb9-4ab8929cc03b \
  --env=dev --path=/ -- env PDF_NODE_BINARY=/usr/bin/node APP_ORIGIN=http://localhost:3000 bun run start
```

Sign in to access your private Convex workspace. The server validates Clerk sessions and Convex independently derives document ownership from the Clerk JWT. Missing service configuration remains an error. Historical local documents are preserved on disk but do not appear in the connected app and are not migrated. Historical browser draft keys are untouched and no longer read or written.

## Editing

Choose one of four blank layouts: Jake's Resume, Deedy, AltaCV-style, or moderncv. [Template attribution](docs/templates.md) describes their adaptations and engines. Add your own verified details.

Autosave uses digest and revision compare-and-set. Conflicts keep the unsaved source in memory; download it before leaving or reloading. Ctrl/Command+S saves and compiles. Ctrl/Command+K opens commands. PDF text is selectable; double-click-to-source is an approximate exact-text search, not SyncTeX.

The theme follows the operating system by default, including live changes. Choose System, Light, or Dark to persist a preference. If browser storage is unavailable, the choice lasts for the current page.

## Assistant and ATS

The assistant requires `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. It sends a real structured function-call request; all edits become exact, digest-bound proposals requiring review. Unsupported new metrics and named skills require author evidence. Review factual accuracy before accepting a change.

ATS checks parse the compiled PDF, including text order, contact fields, dates, headings, columns, and job keywords. They are a heuristic, not an external vendor score. See [methodology](docs/ats-methodology.md), [tools and authenticated MCP](docs/agent-tools.md), and [sandbox architecture](docs/architecture.md).

## Verification

```sh
bun run format:check
bun run lint
bun run typecheck
PDF_NODE_BINARY=/usr/bin/node bun run test
# Inject the same Infisical environment for build and real-service browser tests:
bun run build
bun run test:e2e
```

Unit fixtures and SQLite test doubles live exclusively under `tests/`. Template and compiler tests use the actual sandbox and PDF extraction. Convex emulator tests verify identity and atomic transitions. Browser tests use disposable, marked Clerk users, their private Convex documents, and the configured real model. They run one headless Chromium worker, attach diagnostics before navigation, disable credential-bearing traces, and clean up only test-owned records. External authenticated MCP e2e requires separately supplied MCP credentials.
