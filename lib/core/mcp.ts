import { z } from "zod";
import { engineSchema, sourceSchema } from "./model";
export const agentKeySchema = z.object({
  id: z.string(),
  label: z.string(),
  prefix: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
});
export const saveDocumentSchema = z
  .object({
    id: z.string().min(1).max(100),
    baseDigest: z.string().regex(/^[a-f0-9]{64}$/),
    expectedRevision: z.number().int().positive(),
    source: sourceSchema,
    engine: engineSchema,
    name: z.string().min(1).max(80).optional(),
  })
  .strict();
export type AgentKey = z.infer<typeof agentKeySchema>;
export const createDocumentSchema = z
  .object({
    template: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(80),
  })
  .strict();
export const patchDocumentSchema = saveDocumentSchema
  .pick({
    id: true,
    baseDigest: true,
    expectedRevision: true,
  })
  .extend({
    edits: z
      .array(
        z
          .object({
            expected: z.string().min(1).max(160_000),
            replacement: z.string().max(160_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

// Selectors refer to the original source; ambiguous or overlapping edits never write.
export function patchedSource(
  source: string,
  edits: z.infer<typeof patchDocumentSchema>["edits"],
) {
  const ranges = edits
    .map(({ expected, replacement }) => {
      const from = source.indexOf(expected);
      if (from < 0 || source.indexOf(expected, from + 1) !== -1)
        throw new Error("Patch expected text must occur exactly once");
      return { from, to: from + expected.length, replacement };
    })
    .sort((a, b) => a.from - b.from);
  for (let i = 1; i < ranges.length; i++)
    if (ranges[i].from < ranges[i - 1].to)
      throw new Error("Patch edits overlap");
  let next = source;
  for (const edit of ranges.toReversed())
    next = next.slice(0, edit.from) + edit.replacement + next.slice(edit.to);
  return sourceSchema.parse(next);
}
