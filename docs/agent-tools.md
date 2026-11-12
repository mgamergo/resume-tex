# Structured editing and MCP

The authoritative source is a JavaScript UTF-16 string. A proposal carries `baseDigest`, a title/explanation, and ordered exact edits `{start,end,expected,replacement}`. Ranges must match and cannot overlap. Proposal creation and application both reject a stale digest. Provider results remain bound to the snapshot read **before** the asynchronous provider request; old offsets cannot be rebound onto newer source. Saves also compare immutable revision numbers so metadata-only races fail.

The same validated registry powers HTTP assistant actions and MCP.

| Tool                | Result                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `read_document`     | Source, digest, revision, current edit policy and numbered lines.                                                                                                  |
| `range_patch`       | Up to 30 exact changes, at most 4,000 characters per replaced span, 8,000 total changed characters, and under half the document. Whole-document replacements fail. |
| `insert_section`    | Escaped user content before the document end.                                                                                                                      |
| `rewrite_bullet`    | One line, at most 2,000 characters, with no structural document commands.                                                                                          |
| `reorder_sections`  | Every existing section moved intact. Multi-column minipage layouts require manual review.                                                                          |
| `fix_compile_error` | Missing document closure or a known misspelled command. Unsupported repairs fail with a source-review instruction.                                                 |
| `tailor_to_job`     | Existing adjacent bullets reordered by job language. No new claims.                                                                                                |

Agent edits default to review. In the Assistant panel, each resume can allow automatic application for both the built-in assistant and external MCP agents. Valid automatic edits create accepted proposals and immutable revisions in one transaction. Review-mode edits remain pending for Accept or Reject. Undo proposal restores its previous revision as another new revision. Ordinary editor undo remains available for source edits. Numeric evidence not already in source and unsupported known skill names are rejected. User review is still needed for semantics, omitted context and non-numeric claims.

## Run stdio MCP

First create a resume in the app. Obtain its ID and digest from authenticated `GET /api/workspace` and `GET /api/workspace?id=...`, or inspect the read tool. The server never opens an HTTP port.

```sh
MCP_RESUME_ID=your-resume-id MCP_CLERK_TOKEN=your-short-lived-jwt bun run mcp
```

Configure your MCP client to spawn `bun scripts/mcp.ts` with that working directory and environment. MCP requires the Convex URL, `CLERK_SECRET_KEY`, and a short-lived Clerk-issued Convex JWT in `MCP_CLERK_TOKEN`, all injected from Infisical. The token is cryptographically verified for audience `convex`; Convex independently validates identity and ownership. Do not share server credentials with external clients. The client receives only stdio tool results, not environment variables.

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

No permission-setting, acceptance, shell, arbitrary file or generic network tool is exposed. The UI polls the source, permission, history and proposals every 12 seconds. Clean editors adopt external changes; dirty drafts are preserved and autosave pauses until the owner explicitly loads the saved source. Requests use size/rate/origin checks; ownership is validated independently in Convex. Unit and Convex tests cover structured edits, permission changes and atomic application. The connected browser suite includes an actual stdio MCP client with a short-lived test-owned Clerk JWT.

`propose_edit` retains its inputs. Its result is either `{kind: "proposal", proposal}` for pending review, or `{kind: "applied", proposal, resume}` after an automatic commit. Read the latest document before preparing another edit. Permission is captured before planning; a change during that request leaves the edit pending. Source conflicts still fail. Existing pending proposals are never accepted merely by enabling autonomy.

See [Agent autonomy](agent-autonomy.md) for the transaction and draft rules.
