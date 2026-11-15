import {
  queryGeneric,
  mutationGeneric,
  internalMutationGeneric,
  makeFunctionReference,
  type GenericQueryCtx,
  type GenericMutationCtx,
  type DataModelFromSchemaDefinition,
  type QueryBuilder,
  type MutationBuilder,
} from "convex/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { z } from "zod";
import {
  engineSchema,
  sourceSchema,
  type Resume,
  type Revision,
} from "../lib/core/model";
import schema from "./schema";
import { saveDocumentSchema } from "../lib/core/mcp";
import {
  resumeSchema,
  resumeSummarySchema,
  revisionSchema,
  revisionSummarySchema,
} from "../lib/core/schemas";
type DataModel = DataModelFromSchemaDefinition<typeof schema>;
const query: QueryBuilder<DataModel, "public"> = queryGeneric;
const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
const internalMutation: MutationBuilder<DataModel, "internal"> =
  internalMutationGeneric;
const idSchema = z.string().min(1).max(100);
const payloadSchema = z
  .object({
    id: idSchema.optional(),
    revision: z.number().int().optional(),
    name: z.string().min(1).max(80).optional(),
    source: sourceSchema.optional(),
    engine: engineSchema.optional(),
    template: z.string().max(80).optional(),
    baseDigest: z.string().optional(),
    expectedRevision: z.number().int().optional(),
    note: z.string().max(300).optional(),
  })
  .strict();
type Ctx = GenericQueryCtx<DataModel>;
type MutableCtx = GenericMutationCtx<DataModel>;
async function ownerOf(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity)
    throw new ConvexError({
      kind: "resume-tex",
      status: 401,
      code: "unauthenticated",
      message: "Authentication required",
    });
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
  if (!value)
    throw new ConvexError({
      kind: "resume-tex",
      status: 404,
      code: "not_found",
      message: "Resume not found",
    });
  return resumeSchema.parse(JSON.parse(value.body));
}
async function relatedRows(ctx: Ctx, owner: string, id: string, kind: string) {
  return ctx.db
    .query("records")
    .withIndex("by_resume", (q) =>
      q.eq("owner", owner).eq("resumeId", id).eq("kind", kind),
    )
    .order("desc")
    .take(100);
}
async function historyFor(ctx: Ctx, owner: string, id: string) {
  return (await relatedRows(ctx, owner, id, "history"))
    .map((r) => revisionSummarySchema.parse(JSON.parse(r.body)))
    .sort((a, b) => b.revision - a.revision);
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
  const { source: listingSource, ...listing } = resume;
  void listingSource;
  const existingListing = await row(ctx, owner, "listing", resume.id);
  const listingFields = {
    owner,
    kind: "listing",
    key: resume.id,
    resumeId: resume.id,
    body: JSON.stringify(listing),
  };
  if (existingListing) await ctx.db.replace(existingListing._id, listingFields);
  else await ctx.db.insert("records", listingFields);
  const { source: _source, ...summary } = { ...resume, note };
  void _source;
  await ctx.db.insert("records", {
    owner,
    kind: "history",
    key: `${resume.id}:${resume.revision}`,
    resumeId: resume.id,
    body: JSON.stringify(summary),
  });
}
async function readFor(
  ctx: Ctx,
  owner: string,
  args: { op: string; payload: string },
) {
  const input = payloadSchema.parse(JSON.parse(args.payload));
  if (args.op === "list") {
    const rows = await ctx.db
      .query("records")
      .withIndex("by_key", (q) => q.eq("owner", owner).eq("kind", "listing"))
      .take(51);
    return rows
      .filter((r) => r.kind === "listing")
      .map((r) => resumeSummarySchema.parse(JSON.parse(r.body)));
  }
  const id = idSchema.parse(input.id);
  const current = await get(ctx, owner, id);
  if (args.op === "get") return current;
  if (args.op === "details")
    return {
      resume: current,
      history: await historyFor(ctx, owner, id),
    };
  if (args.op === "revision") {
    const value = await row(
      ctx,
      owner,
      "revision",
      `${id}:${z.number().int().parse(input.revision)}`,
    );
    if (!value)
      throw new ConvexError({
        kind: "resume-tex",
        status: 404,
        code: "not_found",
        message: "Revision not found",
      });
    return revisionSchema.parse(JSON.parse(value.body));
  }
  if (args.op === "history") return historyFor(ctx, owner, id);
  throw new ConvexError({
    kind: "resume-tex",
    status: 400,
    code: "invalid",
    message: "Unknown operation",
  });
}
async function writeFor(
  ctx: MutableCtx,
  owner: string,
  args: { op: string; payload: string },
) {
  const raw: unknown = JSON.parse(args.payload);
  const input = payloadSchema.parse(raw);
  if (args.op === "create") {
    const existing = await ctx.db
      .query("records")
      .withIndex("by_key", (q) => q.eq("owner", owner).eq("kind", "listing"))
      .take(51);
    if (existing.filter((r) => r.kind === "listing").length >= 50)
      throw new ConvexError({
        kind: "resume-tex",
        status: 429,
        code: "limit",
        message: "Resume limit reached",
      });
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
    const doc = await row(ctx, owner, "resume", id);
    if (doc) await ctx.db.delete(doc._id);
    const listing = await row(ctx, owner, "listing", id);
    if (listing) await ctx.db.delete(listing._id);
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("workspace:cleanup"),
      { owner, id },
    );
    return;
  }
  if (args.op === "save") {
    if (
      current.digest !== input.baseDigest ||
      current.revision !== input.expectedRevision
    )
      throw new ConvexError({
        kind: "resume-tex",
        status: 409,
        code: "conflict",
        message: "Revision conflict",
      });
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
  throw new ConvexError({
    kind: "resume-tex",
    status: 400,
    code: "invalid",
    message: "Unknown operation",
  });
}

export const read = query({
  args: { op: v.string(), payload: v.string() },
  handler: async (ctx, args) => readFor(ctx, await ownerOf(ctx), args),
});
export const write = mutation({
  args: { op: v.string(), payload: v.string() },
  handler: async (ctx, args) => writeFor(ctx, await ownerOf(ctx), args),
});

export const cleanup = internalMutation({
  args: { owner: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("records")
      .withIndex("by_resume", (q) =>
        q.eq("owner", args.owner).eq("resumeId", args.id),
      )
      .take(5);
    for (const item of rows) await ctx.db.delete(item._id);
    if (rows.length === 5)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("workspace:cleanup"),
        args,
      );
  },
});

const keySchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    keyHash: z.string().regex(/^[a-f0-9]{64}$/),
    prefix: z.string().regex(/^rtx_[a-f0-9]{8}$/),
    expiresAt: z.number().int(),
  })
  .strict();
function denied(message = "Invalid or expired MCP key", status = 401): never {
  throw new ConvexError({
    kind: "resume-tex",
    status,
    code: "unauthenticated",
    message,
  });
}
async function personalOwner(ctx: Ctx) {
  const owner = await ownerOf(ctx);
  if (
    !process.env.MCP_OWNER_CLERK_ID ||
    owner !== process.env.MCP_OWNER_CLERK_ID
  )
    denied("MCP access is restricted to the configured owner", 403);
  return owner;
}
async function agentOwner(ctx: Ctx, apiKey: string) {
  if (!/^rtx_[a-f0-9]{64}$/.test(apiKey)) denied();
  const keyHash = await hash(apiKey);
  const key = await ctx.db
    .query("mcpKeys")
    .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
    .unique();
  if (
    !key ||
    key.expiresAt <= Date.now() ||
    !process.env.MCP_OWNER_CLERK_ID ||
    key.owner !== process.env.MCP_OWNER_CLERK_ID
  )
    denied();
  return key.owner;
}
export const keys = query({
  args: {},
  handler: async (ctx) => {
    const owner = await personalOwner(ctx);
    const rows = await ctx.db
      .query("mcpKeys")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .take(21);
    return rows.map(({ _id, label, prefix, createdAt, expiresAt }) => ({
      id: _id,
      label,
      prefix,
      createdAt,
      expiresAt,
    }));
  },
});
export const issueKey = mutation({
  args: { payload: v.string() },
  handler: async (ctx, args) => {
    const owner = await personalOwner(ctx);
    const input = keySchema.parse(JSON.parse(args.payload));
    const now = Date.now();
    if (input.expiresAt <= now || input.expiresAt > now + 366 * 86400000)
      denied("Key expiry must be within one year", 400);
    const rows = await ctx.db
      .query("mcpKeys")
      .withIndex("by_owner", (q) => q.eq("owner", owner))
      .take(21);
    if (rows.length >= 20)
      denied("Revoke and remove an old key before creating another", 429);
    const id = await ctx.db.insert("mcpKeys", {
      ...input,
      owner,
      createdAt: now,
    });
    return {
      id,
      label: input.label,
      prefix: input.prefix,
      createdAt: now,
      expiresAt: input.expiresAt,
    };
  },
});
export const revokeKey = mutation({
  args: { id: v.id("mcpKeys") },
  handler: async (ctx, args) => {
    const owner = await personalOwner(ctx);
    const key = await ctx.db.get(args.id);
    if (!key || key.owner !== owner) denied("Key not found", 404);
    await ctx.db.delete(args.id);
  },
});
// Time-based credentials must be checked in a fresh transaction, outside the query cache.
export const agentRead = mutation({
  args: { apiKey: v.string(), op: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const owner = await agentOwner(ctx, args.apiKey);
    if (args.op === "authenticate") return { owner };
    if (!["list", "get", "revision"].includes(args.op))
      denied("Unknown agent operation", 400);
    return readFor(ctx, owner, args);
  },
});
export const agentWrite = mutation({
  args: { apiKey: v.string(), payload: v.string() },
  handler: async (ctx, args) =>
    writeFor(ctx, await agentOwner(ctx, args.apiKey), {
      op: "save",
      payload: JSON.stringify(
        saveDocumentSchema.parse(JSON.parse(args.payload)),
      ),
    }),
});
