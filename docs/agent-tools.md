# Structured editing and MCP

The authoritative source is a JavaScript UTF-16 string. A proposal carries `baseDigest`, a title/explanation, and ordered exact edits `{start,end,expected,replacement}`. Ranges must match and cannot overlap. Proposal creation and application both reject a stale digest. Provider results remain bound to the snapshot read **before** the asynchronous provider request; old offsets cannot be rebound onto newer source. Saves also compare immutable revision numbers so metadata-only races fail.

The same validated registry powers HTTP assistant actions and MCP.

| Tool                | Result                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `read_document`     | Source, digest, revision and numbered lines.                                                                                                                       |
| `range_patch`       | Up to 30 exact changes, at most 4,000 characters per replaced span, 8,000 total changed characters, and under half the document. Whole-document replacements fail. |
| `insert_section`    | Escaped user content before the document end.                                                                                                                      |
| `rewrite_bullet`    | One line, at most 2,000 characters, with no structural document commands.                                                                                          |
| `reorder_sections`  | Every existing section moved intact. Multi-column minipage layouts require manual review.                                                                          |
| `fix_compile_error` | Missing document closure or a known misspelled command. Unknown offline repairs fail with a source-review instruction.                                             |
| `tailor_to_job`     | Existing adjacent bullets reordered by job language. No new claims.                                                                                                |

All edits are proposals. Accept/reject is a UI operation; accepted source is a new immutable revision. Undo proposal restores its previous revision as another new revision. Ordinary editor undo remains available for source edits. Numeric evidence not already in source and unsupported known skill names are rejected. User review is still needed for semantics, omitted context and non-numeric claims.

## Run stdio MCP

First create a resume in the app. Obtain its ID and digest from authenticated `GET /api/workspace` and `GET /api/workspace?id=...`, or inspect the read tool. The server never opens an HTTP port.

```sh
APP_MODE=local AI_PROVIDER=mock MCP_RESUME_ID=your-resume-id bun run mcp
```

Configure your MCP client to spawn `bun scripts/mcp.ts` with that working directory and environment. Connected mode requires `APP_MODE=connected`, Convex URL, `CLERK_SECRET_KEY`, and a short-lived Clerk-issued Convex JWT in `MCP_CLERK_TOKEN`, all injected from Infisical. The token is cryptographically verified for audience `convex`; Convex independently validates identity and ownership. Do not share server credentials with external clients. The client receives only stdio tool results, not environment variables.

Protocol surface has `read_document {}` and `propose_edit {baseDigest,call}`. The latter takes one registry call. Example arguments after reading the current digest:

```json
{
  "baseDigest": "<64-character digest from read_document>",
  "call": {
    "tool": "rewrite_bullet",
    "start": 120,
    "end": 160,
    "replacement": "<verified replacement for the exact selected line>"
  }
}
```

No acceptance, shell, arbitrary file or generic network tool is exposed. The UI polls proposals every 12 seconds. Requests use size/rate/origin checks; local mode only accepts loopback hosts. Actual MCP tests initialize the SDK client over stdio, list tools, read, propose, verify source remains unchanged and reject a stale base.
