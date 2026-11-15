# Connect an external agent

Resume TeX is a LaTeX editor. Your external agent finds job listings and reads job descriptions using its own tools. This MCP server lets it create and edit your resumes, compile them, inspect errors, and retrieve actual PDF bytes. There is no model provider or job scoring service in the app.

## Create a key

Set `MCP_OWNER_CLERK_ID` to your Clerk user ID in both the application and its Convex deployment. Deploy the current Convex schema/functions first. See [deployment steps](deployment.md). Missing configuration disables MCP; other signed-in accounts cannot issue keys.

Sign in as that owner, open **MCP** in the header settings, enter an agent name, and choose **Create key**. Copy the secret once. Only its SHA-256 hash is stored; later visits show its prefix. Keys expire after 90 days. **Revoke** immediately denies subsequent tool calls and PDF reads. Keep keys in your agent's secret store or process environment, never in Git.

The Streamable HTTP endpoint is `https://resume-tex.buildwithkuro.tech/api/mcp`. Send `Authorization: Bearer <key>`. This uses configured bearer headers rather than OAuth discovery.

## Claude Code

With `RESUME_TEX_MCP_KEY` supplied securely to Claude's environment, put this in `.mcp.json`:

```json
{
  "mcpServers": {
    "resume-tex": {
      "type": "http",
      "url": "https://resume-tex.buildwithkuro.tech/api/mcp",
      "headers": { "Authorization": "Bearer ${RESUME_TEX_MCP_KEY}" }
    }
  }
}
```

Claude Code expands environment references in MCP configuration. See [its MCP documentation](https://code.claude.com/docs/en/mcp).

## Codex

Add this to `~/.codex/config.toml`, and supply the raw key in `RESUME_TEX_MCP_KEY` when starting Codex:

```toml
[mcp_servers.resume-tex]
url = "https://resume-tex.buildwithkuro.tech/api/mcp"
bearer_token_env_var = "RESUME_TEX_MCP_KEY"
```

`bearer_token_env_var` sends the Authorization bearer header. See [the Codex MCP reference](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Generic MCP client

Use this shape for clients that accept URL and headers, including compatible bots. Replace the placeholder in the client's private configuration. Environment substitution is client-specific.

```json
{
  "mcpServers": {
    "resume-tex": {
      "url": "https://resume-tex.buildwithkuro.tech/api/mcp",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}
```

Clients restricted to stdio can use the repository bridge with installed dependencies:

```json
{
  "mcpServers": {
    "resume-tex": {
      "command": "bun",
      "args": ["/absolute/path/to/resume-tex/scripts/mcp.ts"],
      "env": {
        "MCP_URL": "https://resume-tex.buildwithkuro.tech/api/mcp",
        "MCP_API_KEY": "<your-key>"
      }
    }
  }
}
```

The bridge receives no Clerk secret, Convex credentials or model key. Remote connections require HTTPS; HTTP is accepted only on loopback.

## Tools and workflow

| Tool              | Input                                                                       | Result                                                                                                              |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `list_templates`  | None                                                                        | Template IDs, names, engines and source.                                                                            |
| `create_document` | `template`, `name`                                                          | Saved owner-bound resume and revision 1.                                                                            |
| `list_documents`  | None                                                                        | Your resume summaries.                                                                                              |
| `read_document`   | `id`                                                                        | LaTeX, engine, digest, revision and metadata.                                                                       |
| `write_document`  | `id`, `source`, `engine`, `baseDigest`, `expectedRevision`, optional `name` | Full source replacement as a new immutable revision.                                                                |
| `patch_document`  | `id`, `baseDigest`, `expectedRevision`, `edits: [{expected, replacement}]`  | Targeted atomic source edit.                                                                                        |
| `export_source`   | `id`                                                                        | Embedded LaTeX text resource.                                                                                       |
| `compile_pdf`     | `id`                                                                        | Success/failure, bounded compile `log`, line diagnostics, engine, revision and digest; PDF resource URI on success. |

An agent can follow this sequence:

1. Find and read the job listing with its own browser/search tools. Get verified candidate facts from its user.
2. Call `list_templates`, then `create_document`, or select an existing resume from `list_documents`.
3. Call `read_document`. Use `write_document` for a full replacement or `patch_document` for exact-text changes. Every `expected` selector must occur exactly once in the original source. Selectors cannot overlap. All edits succeed together or nothing writes.
4. Pass the digest and revision from the last read/save to the next edit. A conflict requires a new read and reconciliation. Never blindly retry an old write.
5. Call `compile_pdf`. Read `log` and `diagnostics` directly in the response. Fix LaTeX errors through another read/edit/compile cycle.
6. Pass its successful `uri` to MCP `resources/read`. Decode the returned `application/pdf` base64 `blob` and save it as a PDF.

PDF resources require an active key and recheck document ownership, immutable revision, source digest and engine. They are private, bounded to 10 MiB, and held in the compiler cache. Recompile if evicted. Revocation or document deletion prevents subsequent access to a previously returned URI. No public storage or temporary public URL is required.

A clean browser editor adopts external saves and recompiles. Unsaved browser drafts stay visible with conflict recovery controls. Agents cannot delete resumes, issue keys, change permissions, execute commands, or read arbitrary files.

## Run the HTTP end-to-end test

After initializing a fresh anonymous local Convex backend with `CONVEX_AGENT_MODE=anonymous bunx convex init`, inject the project's Clerk development credentials and issuer, then run:

```sh
bun scripts/verify-mcp.ts
```

The verifier refuses a non-loopback/non-anonymous backend, configures only that disposable backend, creates a marked test owner, runs format/types/lint/unit/Convex/build/browser checks and cleans up. For an already prepared test environment, `bun run test:mcp:e2e` runs the MCP HTTP case alone.

The test uses `tests/fixtures/job-listing.json`. It discovers templates over HTTP, creates a resume, reads and fully replaces source, applies a targeted patch, rejects stale/ambiguous patches, inspects a real failed compile, repairs it, retrieves PDF bytes and asserts the fixture's keywords in the actual PDF. It saves `artifacts/mcp-job-tailored.pdf`, then checks expiry, revocation and browser reconciliation. This exercises deterministic agent tool calls, not an LLM's browsing or writing ability.

The endpoint authenticates every request, validates supplied Origin, caps JSON at 512 KB, rejects batches and bounds request rates. Convex evaluates key validity in fresh transactions, including atomic save/create authorization. Compilation keeps its existing sandbox, single worker, queue/cache bounds and deadlines.
