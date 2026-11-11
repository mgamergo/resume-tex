import { z } from "zod";
export const engineSchema = z.enum(["pdflatex", "xelatex"]);
export type Engine = z.infer<typeof engineSchema>;
export const sourceSchema = z.string().min(1).max(160_000);
export const editSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    expected: z.string().max(160_000),
    replacement: z.string().max(160_000),
  })
  .strict();
export const proposalInputSchema = z
  .object({
    baseDigest: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().min(1).max(120),
    explanation: z.string().max(2000),
    edits: z.array(editSchema).min(1).max(30),
    evidenceNeeded: z.array(z.string().max(300)).max(10).default([]),
  })
  .strict();
export type Edit = z.infer<typeof editSchema>;
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type Resume = {
  id: string;
  name: string;
  source: string;
  digest: string;
  engine: Engine;
  template: string;
  revision: number;
  updatedAt: number;
};
export type Revision = Resume & { note: string };
export type Proposal = ProposalInput & {
  id: string;
  resumeId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let result = "";
  for (const edit of sorted) {
    if (
      edit.start < cursor ||
      edit.end < edit.start ||
      edit.end > source.length ||
      source.slice(edit.start, edit.end) !== edit.expected
    )
      throw new DomainError(
        "The proposed range no longer matches the document. Request a fresh proposal.",
        409,
      );
    result += source.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  return sourceSchema.parse(result + source.slice(cursor));
}
