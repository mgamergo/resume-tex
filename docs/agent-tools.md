# Connect your agents with MCP

Set `MCP_OWNER_CLERK_ID` to your Clerk user ID in both the application environment and the Convex backend environment. The backend already validates the configured Clerk issuer and `convex` audience. An unset owner disables MCP key creation and MCP access. Other signed-in accounts cannot create MCP credentials.

Deploy the updated Convex schema and functions before starting the updated application. This change adds `mcpKeys`; it does not migrate or delete existing resumes, history, or historical proposal records.

Sign in as the configured owner. Open **MCP**, enter an agent name, and select **Create key**. Copy the secret before closing the dialog. The application stores its SHA-256 hash and shows only its prefix afterward. Keys expire after 90 days. **Revoke** deletes a key and prevents subsequent MCP reads, writes, and PDF retrieval.

## Configure a remote MCP client

Use a client that supports Streamable HTTP with configured bearer headers:

```json
{
  "mcpServers": {
    "resume-tex": {
      "url": "https://your-domain/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-key>"
      }
    }
  }
}
```

Use the client's secret store or environment substitution when available. Do not commit the key. Custom bearer authentication does not provide OAuth discovery or interactive OAuth sign-in. Clients that require OAuth need a compatible adapter.

For a client that supports only stdio, run the included bridge on the agent machine:

```json
{
  "mcpServers": {
    "resume-tex": {
      "command": "bun",
      "args": ["/absolute/path/to/resume-tex/scripts/mcp.ts"],
      "env": {
        "MCP_URL": "https://your-domain/api/mcp",
        "MCP_API_KEY": "<your-key>"
      }
    }
  }
}
```

The bridge requires the repository's installed dependencies. It does not require Clerk secrets, a Convex URL, or an AI provider key. It permits HTTP only on loopback and requires HTTPS for remote endpoints.

## Use the document tools

| Tool             | Input                                                                       | Result                                                                            |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `list_documents` | None                                                                        | Saved document summaries.                                                         |
| `read_document`  | `id`                                                                        | Source, engine, digest, revision, and metadata.                                   |
| `write_document` | `id`, `source`, `engine`, `baseDigest`, `expectedRevision`, optional `name` | The new saved revision.                                                           |
| `export_source`  | `id`                                                                        | Embedded LaTeX text resource.                                                     |
| `compile_pdf`    | `id`                                                                        | Compile diagnostics, engine, revision, digest, and a PDF resource URI on success. |

Read before writing. Supply both the digest and revision from that read. On conflict, read again and reconcile the sources before making another write. Successful agent writes retain immutable history. A clean browser editor adopts the saved source and recompiles. A dirty browser draft remains visible with conflict recovery controls.

Pass the URI from `compile_pdf` to MCP `resources/read`. It returns `application/pdf` and a base64 `blob`. Decode the blob to save the PDF. MCP supports binary resources directly; no object storage or public download URL is necessary. See the [MCP resource specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources).

PDF access rechecks the key, document ownership, immutable revision, source digest, and engine. Artifacts remain in the bounded private compiler cache. If an artifact has been evicted, compile again. The PDF limit is 10 MiB. A previously issued URI does not grant access after key revocation or document deletion.

## Access boundary

A key grants read and write access to the configured owner's documents. It cannot create keys, change permissions, delete documents, execute arbitrary commands, or access arbitrary files. Bearer credentials authenticate possession of the secret, so give them only to your agents. Browser session cookies alone do not authenticate MCP.

The public endpoint authenticates each request, validates Origin when supplied, bounds request bodies to 512 KB, rejects batch messages, and limits authenticated requests. It keeps no persistent MCP session or event stream. Convex checks key validity in a fresh transaction for each read and save. This avoids time-based authorization results surviving in the query cache. See [Convex guidance on time-dependent queries](https://docs.convex.dev/understanding/best-practices#dont-use-datenow-in-queries). The compiler retains its existing sandbox, single worker, bounded queue, deadlines, and cache limits. A reverse proxy should enforce deployment-level connection and request limits as well.
