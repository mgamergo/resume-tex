import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  mcpKeys: defineTable({
    owner: v.string(),
    keyHash: v.string(),
    label: v.string(),
    prefix: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_hash", ["keyHash"])
    .index("by_owner", ["owner"]),
  records: defineTable({
    owner: v.string(),
    kind: v.string(),
    key: v.string(),
    resumeId: v.string(),
    body: v.string(),
  })
    .index("by_owner", ["owner"])
    .index("by_key", ["owner", "kind", "key"])
    .index("by_resume", ["owner", "resumeId", "kind"]),
});
