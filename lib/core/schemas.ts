import { z } from "zod";
import { engineSchema, sourceSchema } from "./model";
export const resumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: sourceSchema,
  digest: z.string(),
  engine: engineSchema,
  template: z.string(),
  revision: z.number().int(),
  updatedAt: z.number(),
});
export const resumeSummarySchema = resumeSchema.omit({ source: true });
export const revisionSchema = resumeSchema.extend({ note: z.string() });
export const revisionSummarySchema = revisionSchema.omit({ source: true });
export const diagnosticSchema = z.object({
  line: z.number(),
  column: z.number(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
});
export const compileSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    artifact: z.string(),
    digest: z.string(),
    engine: engineSchema,
    revision: z.number(),
    log: z.string(),
    diagnostics: z.array(diagnosticSchema),
    cached: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    digest: z.string(),
    engine: engineSchema,
    revision: z.number(),
    log: z.string(),
    diagnostics: z.array(diagnosticSchema),
    error: z.string(),
  }),
]);
