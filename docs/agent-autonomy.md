# Agent autonomy

Each resume defaults to **Review each edit**. The Assistant panel offers **Apply automatically**, covering the built-in assistant and connected MCP agents. Automatic edits use the existing bounded tools and factual checks. They create accepted proposals and content revisions, so Undo proposal and history remain available.

## Permission boundary

Convex stores one owner-scoped `agent-edit-policy` record per resume, separate from content. Missing means review/version zero; malformed records fail closed. Actual mode changes increment an independent nonnegative version. Content saves, restore and Undo cannot restore a permission grant.

The shared tool executor reads source and permission atomically before model planning. Submission checks the captured digest and content revision. A single mutation applies an edit only if the current permission is autonomous, its version still matches and no evidence is outstanding. Otherwise a valid edit becomes pending. Exact ranges and resulting source limits are revalidated in the mutation.

Disabling during planning, disabling then re-enabling, or enabling after a review-mode request began all leave that request pending. Enabling never sweeps existing proposals. Concurrent edits against one revision cannot both commit. Revocation affects future commits; Undo handles changes already committed.

MCP exposes no setting or approval tool. This limits the tool surface; an owner's Convex JWT still represents that owner at the backend.

## Editor synchronization

One details query returns content, permission, history and proposals. Polling adopts newer source only when the editor is clean. During a save or explicit acceptance it defers incoming heads. A dirty editor retains its original saved baseline and typed draft, pauses autosave, and offers draft download or explicit discard-and-load. Save acknowledgements preserve typing entered after submission. Older revisions, permission versions and other document sessions cannot replace current state. PDF results must match the adopted revision, digest and engine.

## Design decision

A separate policy record preserves the existing content/history model. Embedding permission in Resume would require splitting every historical projection to keep restore from reviving grants. Both are viable; independent storage is the smaller change here. HTTP and MCP retain one validated submission path and one authoritative Convex transaction.

## Verification

Unit tests and the Convex emulator cover review defaults, owner isolation, policy CAS, revocation timing, concurrent submissions, evidence blocking and restore. Connected Chromium tests cover the real model, persisted permission, history/Undo, actual stdio MCP and dirty draft preservation. Results and any unavailable live checks are recorded in logbook.md.
