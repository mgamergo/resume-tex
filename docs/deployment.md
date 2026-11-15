# Dokploy deployment

Resume TeX runs as the `resume-tex` Compose service in the existing **Chaitanya** project at <https://resume-tex.buildwithkuro.tech>.

## Runtime

`Dockerfile` builds Next.js and the trusted TeX toolchain with Bun 1.4.4 and Node 22.23.4. The runtime contains production dependencies, generated assets and the compiler runtime. Tests, local environment files and development data are excluded. Next.js listens on the container network at port 3000; no host port is published.

The container runs as UID/GID 10001, drops all Linux capabilities and uses a read-only root filesystem. A named volume holds `/app/.data`, and `/tmp` is a bounded tmpfs. Resource limits are two CPUs, 2 GiB memory and 256 processes. Keep one replica because compilation queues and cache coordination are process-local.

Bubblewrap remains the compiler boundary. Startup checks that private namespaces work and that application files, credentials and network routes are absent inside the sandbox. It refuses to start if that check fails. Docker's default syscall and masked-proc policies prevent these nested mounts, so this service explicitly configures `seccomp:unconfined`, `apparmor:unconfined` and `systempaths=unconfined`, together with `no-new-privileges`. These settings apply only to this service. It has no privileged mode, host filesystem mount or Docker socket. Compiler filesystem, network, timeout and output limits remain those in [the compilation policy](compilation.md).

## Settings

The initial deployment uses an allowlisted snapshot of the existing Resume TeX **development** settings from Infisical. Its production environment was empty. Clerk and Convex are real services; there is no local or mock runtime. Moving to production Clerk/Convex accounts is a separate configuration change.

Supply these settings through the service's Environment configuration:

- `APP_ORIGIN=https://resume-tex.buildwithkuro.tech`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `CLERK_SECRET_KEY`
- `MCP_OWNER_CLERK_ID`

Only the three `NEXT_PUBLIC_*` settings are build arguments. Private keys are supplied at runtime and never passed to image construction. The image supplies its own `PDF_NODE_BINARY`, `TEX_TOOLS_DIR` and `DATA_DIR`; workstation paths must not be copied into these settings.

Infisical changes are not automatically synchronized to Dokploy. Refresh the service settings after rotating credentials, then redeploy. Changes to public settings require a rebuild because Next.js embeds them in browser assets. Convex functions are deployed independently; this container does not receive a Convex deployment key.

## Redeploy

The service uses Dokploy's existing GitHub connection for the private `mgamergo/resume-tex` repository, branch `dev`, with `compose.yaml`. Automatic deployments are disabled. Push the reviewed commit, then choose **Deploy** on this service. Check the build result, healthy container status and the public HTTPS URL. Verify authenticated editing and actual PDF compilation after changes to the image or host policy.

The persistent development box remains separate from the deployed service. Do not destroy it or modify unrelated Dokploy services as part of redeployment.

Set `MCP_OWNER_CLERK_ID` in both the app runtime and Convex backend before creating keys. Deploy Convex functions and schema before the application. No AI provider environment variables are required. This code change does not deploy either service.

## Changes required for the Overleaf-only release

Add only `MCP_OWNER_CLERK_ID` to Dokploy. Its value is the personal `user_…` ID from Clerk Dashboard → Users → your account, matching the existing Clerk application. It is not a key. Remove `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`; there is no provider code. Keep `APP_ORIGIN`, all three existing `NEXT_PUBLIC_*` values, and `CLERK_SECRET_KEY`. No MCP credential or Convex deployment key belongs in Dokploy.

Before rebuilding the app, deploy Convex separately from this revision. Securely inject `CONVEX_DEPLOY_KEY` for the **exact existing deployment** referenced by Dokploy's `NEXT_PUBLIC_CONVEX_URL`. Get its deploy key from that deployment's Convex Dashboard settings. In a clean checkout without anonymous test configuration, run:

```sh
bun install --frozen-lockfile
# CONVEX_DEPLOY_KEY must already be injected securely; never commit it.
bunx convex env set MCP_OWNER_CLERK_ID <your-clerk-user-id>
bunx convex deploy
```

These commands change the backend and must be run by the operator. Preserve `CLERK_JWT_ISSUER_DOMAIN` on that backend, matching the Clerk application's issuer domain. The deploy key selects its associated deployment, even if the hosted app uses development accounts. Do not create a new deployment or point Dokploy to a test backend.

Then deploy the current `dev` commit manually in Dokploy and verify the new build actually becomes healthy. Missing `MCP_OWNER_CLERK_ID` makes compose interpolation fail before the build; the previous container can remain live. Pushes alone do not deploy this service.

## Check Compose interpolation without provider settings

At `b5f53d4`, `compose.yaml`, `Dockerfile`, `.env.example`, the startup script, Next config and package scripts contain no `AI_*` references. The only executable reference is in `scripts/verify-mcp.ts`, which deletes the three old provider variables before verification. Nothing in the application build or runtime reads them.

From the repository root, this check uses only the six application settings below, with dummy values. The empty environment and explicit empty env file prevent inherited provider settings from masking a required interpolation:

```sh
env -i PATH="$PATH" \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=dummy \
  NEXT_PUBLIC_CONVEX_URL=https://dummy.convex.cloud \
  NEXT_PUBLIC_CONVEX_SITE_URL=https://dummy.convex.site \
  CLERK_SECRET_KEY=dummy \
  APP_ORIGIN=https://resume.example.test \
  MCP_OWNER_CLERK_ID=user_dummy \
  docker compose --env-file /dev/null -f compose.yaml config --quiet
```

This validates Compose configuration without building or starting containers. It exits zero with the checked-in file. If a deployment reports a required `AI_API_KEY`, `AI_BASE_URL` or `AI_MODEL`, compare its actual Git revision, stored Compose configuration and override files with `git show origin/dev:compose.yaml`. That error cannot originate from this revision's Compose file.
