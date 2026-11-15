# Architecture

LaTeX source is authoritative. The browser uses Clerk to obtain a Convex JWT. Convex derives document ownership from the verified identity, stores immutable revisions, and atomically checks digest plus revision on saves. The browser keeps unsaved drafts in memory and preserves them on conflicts.

The editor pairs CodeMirror with a PDF preview. These modules load when a document opens. PDF.js loads one document per artifact, retains it across zoom changes, renders only pages near the viewport, and releases offscreen canvases. Visible page bitmaps have a four-million-pixel budget. Document refresh pauses while the browser tab is hidden.

MCP uses the existing public domain at `/api/mcp`. The configured personal Clerk account creates expiring opaque credentials. Convex stores only their hashes, resolves ownership from a valid key, and checks revocation and expiry inside every save transaction. Agent reads also use fresh transactions so cached query results cannot outlive key expiry. Browser and MCP saves share the same private owner-scoped implementation. Public functions never trust a submitted owner ID. See [agent connection instructions](agent-tools.md).

The HTTP adapter creates a request-local MCP server and stateless transport. It does not maintain a session registry or event stream. Agents list templates, create resumes, read/replace/patch source, inspect compile logs, export LaTeX, and read binary PDF resources. Exact-text patches resolve against one original source and save through the existing digest/revision CAS. Template creation uses the same owner-bound backend transaction as browser creation. The stdio bridge forwards the same protocol and needs only the endpoint and bearer key.

Compilation uses the existing Bubblewrap sandbox with offline TeX, a clean environment, bounded scratch space, kernel resource limits, deadline, one worker, and a bounded queue/cache. PDF resources verify the artifact against the requested revision and engine. No public object storage is required. See [compilation](compilation.md).

The in-app Assistant, provider adapter, proposal APIs/state, ATS scoring, PDF field parser and job matching were removed. PDF text extraction remains test-only to verify compiler output. Existing historical proposal records remain untouched. No AI provider configuration is required.

The design considered maintaining a trusted gateway's Clerk session instead of issuing MCP keys. Dedicated credentials avoid interactive session renewal and permit direct revocation. The tradeoff is custom bearer configuration rather than OAuth discovery. Browser ownership remains tenant-scoped; MCP issuance is restricted to the configured personal account. Both independent design assessments favored this boundary.
