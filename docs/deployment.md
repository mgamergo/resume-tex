# Dokploy deployment

Resume TeX runs as the `resume-tex` Compose service in the existing **Chaitanya** project at <https://resume-tex.buildwithkuro.tech>.

## Runtime

`Dockerfile` builds Next.js and the trusted TeX toolchain with Bun 1.4.4 and Node 22.23.4. The runtime contains production dependencies, generated assets and the compiler runtime. Tests, local environment files and development data are excluded. Next.js listens on the container network at port 3000; no host port is published.

The container runs as UID/GID 10001, drops all Linux capabilities and uses a read-only root filesystem. A named volume holds `/app/.data`, and `/tmp` is a bounded tmpfs. Resource limits are two CPUs, 2 GiB memory and 256 processes. Keep one replica because compilation queues and cache coordination are process-local.

Bubblewrap remains the compiler boundary. Startup checks that private namespaces work and that application files, credentials and network routes are absent inside the sandbox. It refuses to start if that check fails. Docker's default syscall and masked-proc policies prevent these nested mounts, so this service explicitly configures `seccomp:unconfined`, `apparmor:unconfined` and `systempaths=unconfined`, together with `no-new-privileges`. These settings apply only to this service. It has no privileged mode, host filesystem mount or Docker socket. Compiler filesystem, network, timeout and output limits remain those in [the compilation policy](compilation.md).

## Settings

The initial deployment uses an allowlisted snapshot of the existing Resume TeX **development** settings from Infisical. Its production environment was empty. Clerk, Convex and the LLM are real services; there is no local or mock runtime. Moving to production Clerk/Convex accounts is a separate configuration change.

Supply these settings through the service's Environment configuration:

- `APP_ORIGIN=https://resume-tex.buildwithkuro.tech`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `CLERK_SECRET_KEY`

Only the three `NEXT_PUBLIC_*` settings are build arguments. Private keys are supplied at runtime and never passed to image construction. The image supplies its own `PDF_NODE_BINARY`, `TEX_TOOLS_DIR` and `DATA_DIR`; workstation paths must not be copied into these settings.

Infisical changes are not automatically synchronized to Dokploy. Refresh the service settings after rotating credentials, then redeploy. Changes to public settings require a rebuild because Next.js embeds them in browser assets. Convex functions are deployed independently; this container does not receive a Convex deployment key.

## Redeploy

The service uses Dokploy's existing GitHub connection for the private `mgamergo/resume-tex` repository, branch `dev`, with `compose.yaml`. Automatic deployments are disabled. Push the reviewed commit, then choose **Deploy** on this service. Check the build result, healthy container status and the public HTTPS URL. Verify authenticated editing and actual PDF compilation after changes to the image or host policy.

The persistent development box remains separate from the deployed service. Do not destroy it or modify unrelated Dokploy services as part of redeployment.

Set `MCP_OWNER_CLERK_ID` in both the app runtime and Convex backend before creating keys. Deploy Convex functions and schema before the application. No AI provider environment variables are required. This code change does not deploy either service.
