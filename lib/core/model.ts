import { z } from "zod";
export const engineSchema = z.enum(["pdflatex", "xelatex"]);
export type Engine = z.infer<typeof engineSchema>;
export const sourceSchema = z.string().min(1).max(160_000);
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
export type ResumeSummary = Omit<Resume, "source">;
export type RevisionSummary = Omit<Revision, "source">;
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
