# Configure cloud accounts

The application requires Clerk authentication, Convex storage, and a configured OpenAI-compatible assistant.

## Add application settings to Infisical

A dedicated project exists at `https://secrets.buildwithkuro.tech`: `resume-tex`, project ID `35ecfc68-85d2-470c-9cb9-4ab8929cc03b`. Its environments are `dev`, `staging`, and `prod`. Use the development environment for setup. Do not copy unrelated project secrets.

Create a Clerk application and activate its Convex integration. Configure the app's Clerk publishable and secret keys in the resume-tex Infisical environment. Configure the Clerk issuer domain for the Convex backend as described by the [official integration guide](https://docs.convex.dev/auth/clerk). Check the repository's `.env.example` for the exact variable names consumed by this revision.

Create the corresponding Convex development deployment and configure its public URL in Infisical. Push the repository's Convex schema/functions to that development deployment using Convex's CLI after account sign-in. The backend must validate the Clerk issuer and `convex` audience. Never disable identity checks to work around setup errors.

For a real assistant, choose a provider compatible with the configured adapter and add its endpoint, model, and API key to the same Infisical project.

## Inject settings into commands

The installed CLI is Infisical 0.45.4. Its supported process-injection command was checked on the session devbox:

```sh
infisical secrets-manager run \
  --domain=https://secrets.buildwithkuro.tech \
  --projectId=35ecfc68-85d2-470c-9cb9-4ab8929cc03b \
  --env=dev --path=/ -- bun run dev
```

If an HTTPS reverse proxy serves the app, set `APP_ORIGIN` to the browser origin in Infisical. Origin checks compare against that configured value.

Inject settings into builds too, because Next.js public variables are compiled into browser assets. Rebuild when those public settings change. Use the same project/environment scope for build and startup. Public client keys and deployment URLs are configuration, but private provider keys and Clerk server keys must remain server-only.

Do not print environment variables or export secrets into Git. The compiler receives a separate clean environment and must never receive application credentials.

## Verify the account wiring

After setup, sign in through Clerk and create, edit, save, compile, and restore a resume. Sign out, then sign in as another user and confirm that the first user's resumes and proposals are inaccessible. Check that source and PDFs return unauthorized responses without a valid session. Test an assistant proposal with the configured model, then accept and reject proposals through the review UI.

Missing credentials and integration failures remain visible. This setup guide does not authorize deployment, public ports, domain changes, or changes to Dokploy.
