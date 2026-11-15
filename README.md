# Resume TeX

A LaTeX resume workspace with a source editor, compiled PDF, private MCP access, version history. Bun manages dependencies and runs builds and tests. Next.js runs on Node.js 22.

## Setup

Requirements: Linux x86-64, Bun 1.4.4, Node.js 22 at `/usr/bin/node`, Bubblewrap with unprivileged namespaces, `prlimit`, `curl`, `tar`, `xz`, `ldd`, and system fonts. The setup script installs user-local TinyTeX and a sandbox runtime; it does not install system packages.

```sh
bun install --frozen-lockfile
bun run setup:tex
```

Configure Clerk and Convex in the dedicated Infisical project. See [cloud setup](docs/cloud-setup.md) and [.env.example](.env.example). Build and run with the same injected public configuration:

If system Node is a different version, set `PDF_NODE_BINARY` in `.env.local` to the absolute path of a Node 22 binary. Tests require this variable in the shell environment because Bun does not load `.env.local` in test mode. The TeX setup uses Bash when Dash is unavailable.

```sh
infisical run \
  --domain=https://secrets.buildwithkuro.tech \
  --projectId=35ecfc68-85d2-470c-9cb9-4ab8929cc03b \
  --env=dev --path=/ -- bun run build

infisical run \
  --domain=https://secrets.buildwithkuro.tech \
  --projectId=35ecfc68-85d2-470c-9cb9-4ab8929cc03b \
  --env=dev --path=/ -- env PDF_NODE_BINARY=/usr/bin/node APP_ORIGIN=http://localhost:3000 bun run start
```

Sign in to access your private Convex workspace. The server validates Clerk sessions and Convex independently derives document ownership from the Clerk JWT. Missing service configuration remains an error. Historical local documents are preserved on disk but do not appear in the connected app and are not migrated. Historical browser draft keys are untouched and no longer read or written.

For the hosted service, image policy and redeployment steps, see [Dokploy deployment](docs/deployment.md).

## Editing

Choose one of four blank layouts: Jake's Resume, Deedy, AltaCV-style, or moderncv. [Template attribution](docs/templates.md) describes their adaptations and engines. Add your own verified details.

Autosave uses digest and revision compare-and-set. Conflicts keep the unsaved source in memory; download it before leaving or reloading. Ctrl/Command+S saves and compiles. Ctrl/Command+K opens commands. PDF text is selectable; double-click-to-source is an approximate exact-text search, not SyncTeX.

The theme follows the operating system by default, including live changes. Choose System, Light, or Dark to persist a preference. If browser storage is unavailable, the choice lasts for the current page.

## External agents

Create revocable agent credentials in **MCP** after configuring your personal Clerk user ID. Agents can list templates, create resumes, read/replace/patch source, inspect compile logs, and obtain PDF bytes directly. No AI provider key is required. See [MCP setup and tools](docs/agent-tools.md).

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

Unit fixtures and SQLite test doubles live exclusively under `tests/`. Template and compiler tests use the actual sandbox and PDF extraction. Convex emulator tests verify identity and atomic transitions. Browser tests use disposable, marked Clerk users, their private Convex documents, and a fresh local Convex backend. They run one headless Chromium worker, attach diagnostics before navigation, disable credential-bearing traces, and clean up only test-owned records. The MCP browser test creates and revokes its own test credential. `scripts/verify-mcp.ts` requires a fresh anonymous loopback Convex deployment and injects a disposable marked Clerk owner.
