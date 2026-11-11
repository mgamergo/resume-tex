import { z } from "zod";
import { engineSchema, proposalInputSchema, sourceSchema } from "./model";
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
export const revisionSchema = resumeSchema.extend({ note: z.string() });
export const proposalSchema = proposalInputSchema.extend({
  id: z.string(),
  resumeId: z.string(),
  status: z.enum(["pending", "accepted", "rejected"]),
  createdAt: z.number(),
});
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
    log: z.string(),
    diagnostics: z.array(diagnosticSchema),
    cached: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    digest: z.string(),
    log: z.string(),
    diagnostics: z.array(diagnosticSchema),
    error: z.string(),
  }),
]);
export const atsSchema = z.object({
  digest: z.string(),
  artifact: z.string(),
  score: z.number(),
  breakdown: z.array(
    z.object({
      name: z.string(),
      earned: z.number(),
      possible: z.number(),
      detail: z.string(),
    }),
  ),
  keywords: z.array(
    z.object({
      term: z.string(),
      required: z.boolean(),
      matched: z.boolean(),
      method: z.enum(["exact", "synonym", "stem", "missing"]),
      weight: z.number(),
    }),
  ),
  findings: z.array(
    z.object({
      id: z.string(),
      level: z.enum(["pass", "warning"]),
      title: z.string(),
      detail: z.string(),
      fix: z.enum(["sections", "impact", "columns"]).optional(),
    }),
  ),
  parsed: z.object({
    contact: z.object({
      name: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      links: z.array(z.string()),
      location: z.string().nullable(),
    }),
    experience: z.array(
      z.object({
        role: z.string().nullable(),
        employer: z.string().nullable(),
        dates: z.string().nullable(),
        evidence: z.string(),
        confidence: z.enum(["medium", "low"]),
      }),
    ),
    education: z.array(
      z.object({
        institution: z.string().nullable(),
        degree: z.string().nullable(),
        dates: z.string().nullable(),
        evidence: z.string(),
        confidence: z.enum(["medium", "low"]),
      }),
    ),
    skills: z.array(z.string()),
    dates: z.array(
      z.object({
        raw: z.string(),
        start: z.string(),
        end: z.string(),
        style: z.enum(["month-name", "numeric", "year-only"]),
        reversed: z.boolean(),
      }),
    ),
    limitations: z.array(z.string()),
  }),
  sections: z.object({
    experience: z.string(),
    education: z.string(),
    skills: z.string(),
  }),
  pdf: z.object({
    text: z.string(),
    pages: z.number(),
    words: z.array(
      z.object({
        text: z.string(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        page: z.number(),
      }),
    ),
    columns: z.boolean(),
    lowTextPages: z.array(z.number()),
  }),
  wordCount: z.number(),
  quantifiedBullets: z.number(),
  jobDescription: z.string(),
});
