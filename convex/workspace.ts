import {
  queryGeneric,
  mutationGeneric,
  type GenericQueryCtx,
  type GenericMutationCtx,
  type DataModelFromSchemaDefinition,
  type QueryBuilder,
  type MutationBuilder,
} from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import {
  applyEdits,
  engineSchema,
  proposalInputSchema,
  sourceSchema,
  type Proposal,
  type Resume,
  type Revision,
} from "../lib/core/model";
import schema from "./schema";
type DataModel = DataModelFromSchemaDefinition<typeof schema>;
const query: QueryBuilder<DataModel, "public"> = queryGeneric;
const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
const idSchema = z.string().min(1).max(100);
const payloadSchema = z
  .object({
    id: idSchema.optional(),
    name: z.string().min(1).max(80).optional(),
    source: sourceSchema.optional(),
    engine: engineSchema.optional(),
    template: z.string().max(80).optional(),
    baseDigest: z.string().optional(),
    expectedRevision: z.number().int().optional(),
    note: z.string().max(300).optional(),
    input: proposalInputSchema.optional(),
    proposalId: idSchema.optional(),
    accept: z.boolean().optional(),
  })
  .strict();
type Ctx = GenericQueryCtx<DataModel>;
type MutableCtx = GenericMutationCtx<DataModel>;
async function ownerOf(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required");
  return identity.subject;
}
async function row(ctx: Ctx, owner: string, kind: string, key: string) {
  return ctx.db
    .query("records")
    .withIndex("by_key", (q) =>
      q.eq("owner", owner).eq("kind", kind).eq("key", key),
    )
    .unique();
}
async function get(ctx: Ctx, owner: string, id: string): Promise<Resume> {
  const value = await row(ctx, owner, "resume", id);
  if (!value) throw new Error("Resume not found");
  return JSON.parse(value.body);
}
async function hash(source: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function writeResume(
  ctx: MutableCtx,
  owner: string,
  resume: Resume,
  note: string,
) {
  const existing = await row(ctx, owner, "resume", resume.id);
  const fields = {
    owner,
    kind: "resume",
    key: resume.id,
    resumeId: resume.id,
    body: JSON.stringify(resume),
  };
  if (existing) await ctx.db.replace(existing._id, fields);
  else await ctx.db.insert("records", fields);
  await ctx.db.insert("records", {
    owner,
    kind: "revision",
    key: `${resume.id}:${resume.revision}`,
    resumeId: resume.id,
    body: JSON.stringify({ ...resume, note } satisfies Revision),
  });
}
export const read = query({
  args: { op: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    const input = payloadSchema.parse(JSON.parse(args.payload));
    if (args.op === "list") {
      const rows = await ctx.db
        .query("records")
        .withIndex("by_key", (q) => q.eq("owner", owner).eq("kind", "resume"))
        .take(51);
      return rows
        .filter((r) => r.kind === "resume")
        .map((r) => JSON.parse(r.body));
    }
    const id = idSchema.parse(input.id);
    const current = await get(ctx, owner, id);
    if (args.op === "get") return current;
    if (args.op === "history" || args.op === "proposals") {
      const kind = args.op === "history" ? "revision" : "proposal";
      const rows = await ctx.db
        .query("records")
        .withIndex("by_resume", (q) =>
          q.eq("owner", owner).eq("resumeId", id).eq("kind", kind),
        )
        .order("desc")
        .take(100);
      return rows
        .map((r) => JSON.parse(r.body))
        .sort(
          (a, b) => (b.revision ?? b.createdAt) - (a.revision ?? a.createdAt),
        );
    }
    throw new Error("Unknown operation");
  },
});
export const write = mutation({
  args: { op: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    const input = payloadSchema.parse(JSON.parse(args.payload));
    if (args.op === "create") {
      const existing = await ctx.db
        .query("records")
        .withIndex("by_key", (q) => q.eq("owner", owner).eq("kind", "resume"))
        .take(51);
      if (existing.filter((r) => r.kind === "resume").length >= 50)
        throw new Error("Resume limit reached");
      const source = sourceSchema.parse(input.source);
      const resume: Resume = {
        id: crypto.randomUUID(),
        name: z.string().min(1).max(80).parse(input.name),
        source,
        digest: await hash(source),
        engine: engineSchema.parse(input.engine),
        template: input.template ?? "custom",
        revision: 1,
        updatedAt: Date.now(),
      };
      await writeResume(ctx, owner, resume, "Created from template");
      return resume;
    }
    const id = idSchema.parse(input.id);
    const current = await get(ctx, owner, id);
    if (args.op === "remove") {
      const rows = await ctx.db
        .query("records")
        .withIndex("by_resume", (q) => q.eq("owner", owner).eq("resumeId", id))
        .take(2000);
      for (const r of rows.filter((r) => r.resumeId === id))
        await ctx.db.delete(r._id);
      return;
    }
    if (args.op === "save") {
      if (
        current.digest !== input.baseDigest ||
        current.revision !== input.expectedRevision
      )
        throw new Error("Revision conflict");
      const source = sourceSchema.parse(input.source);
      const next = {
        ...current,
        source,
        digest: await hash(source),
        name: input.name ?? current.name,
        engine: input.engine ?? current.engine,
        revision: current.revision + 1,
        updatedAt: Date.now(),
      };
      await writeResume(ctx, owner, next, input.note ?? "Saved source");
      return next;
    }
    if (args.op === "propose") {
      const proposalInput = proposalInputSchema.parse(input.input);
      if (current.digest !== proposalInput.baseDigest)
        throw new Error("Stale proposal");
      applyEdits(current.source, proposalInput.edits);
      const proposal: Proposal = {
        ...proposalInput,
        id: crypto.randomUUID(),
        resumeId: id,
        status: "pending",
        createdAt: Date.now(),
      };
      await ctx.db.insert("records", {
        owner,
        kind: "proposal",
        key: proposal.id,
        resumeId: id,
        body: JSON.stringify(proposal),
      });
      return proposal;
    }
    if (args.op === "decide") {
      const proposalRow = await row(
        ctx,
        owner,
        "proposal",
        idSchema.parse(input.proposalId),
      );
      if (!proposalRow || proposalRow.resumeId !== id)
        throw new Error("Proposal not found");
      const proposal: Proposal = JSON.parse(proposalRow.body);
      if (proposal.status !== "pending")
        throw new Error("Proposal already reviewed");
      if (input.accept) {
        if (current.digest !== proposal.baseDigest)
          throw new Error("Stale proposal");
        const source = applyEdits(current.source, proposal.edits);
        const next = {
          ...current,
          source,
          digest: await hash(source),
          revision: current.revision + 1,
          updatedAt: Date.now(),
        };
        await writeResume(ctx, owner, next, `Accepted: ${proposal.title}`);
        await ctx.db.patch(proposalRow._id, {
          body: JSON.stringify({ ...proposal, status: "accepted" }),
        });
        return next;
      }
      await ctx.db.patch(proposalRow._id, {
        body: JSON.stringify({ ...proposal, status: "rejected" }),
      });
      return current;
    }
    throw new Error("Unknown operation");
  },
});
