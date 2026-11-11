# Architecture

LaTeX source is the authoritative document. A saved revision is immutable. A successful PDF and ATS report identify the source digest used to produce them. A later source edit makes those artifacts stale until compilation succeeds again.

The editor saves with an expected revision. A conflicting save is reported instead of overwriting another session. Restoring history creates a new revision. AI proposals carry their base digest and exact expected text. Only a user acceptance writes a proposal, and a changed base rejects it.

Server routes own authentication and transport validation. A persistence adapter owns durable transitions, using authenticated Convex storage. Convex also checks Clerk identity and ownership itself. Structured edit tools are shared by the assistant and MCP transport. Providers produce proposals rather than writes.

Compilation takes fixed source and a selected engine profile. The supervisor owns sandbox creation, timeouts, resource limits, cache identity and artifact collection. Compiler children receive no application environment or credentials. The browser displays real output through PDF.js and derives ATS input from those PDF bytes.

Design alternatives considered: (1) canonical resume JSON generating LaTeX, rejected for lossy arbitrary-source editing; (2) browser-only compilation, deferred for package/font compatibility and client resource variability; (3) server TeX Live with immutable revisions, chosen for predictable template coverage and shared validation.

## Public domain contracts

- Save: `{ documentId, expectedRevision, source, title }` produces a new immutable revision or a conflict.
- Compile: `{ source, engine }` produces a discriminated success/failure result with source digest, bounded log and source diagnostics.
- Proposal: `{ baseDigest, edits: [{ from, to, expected, replacement }], explanation }` validates before any mutation.
- Agent: provider-neutral structured tool calls; read, patch ranges, insert section, rewrite bullet, reorder sections, fix diagnostics and tailor against job data.
- ATS: PDF extraction plus geometry, parsed fields, matched/missing terms, weighted breakdown and explicit limitations.

Single-app modules keep call chains short. Separate deployment services or queues can replace the local compiler supervisor without changing the edit or scoring domain.
