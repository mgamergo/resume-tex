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
