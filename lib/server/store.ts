import { createConvexFetch } from "./convex-fetch";
import { convexOperation } from "./convex-errors";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  Engine,
  Resume,
  ResumeSummary,
  Revision,
  RevisionSummary,
} from "../core/model";
import { z } from "zod";
import { resumeSchema, revisionSummarySchema } from "../core/schemas";
export interface Store {
  list(): Promise<ResumeSummary[]>;
  get(id: string): Promise<Resume>;
  create(input: {
    name: string;
    source: string;
    engine: Engine;
    template: string;
  }): Promise<Resume>;
  save(input: SaveInput): Promise<Resume>;
  remove(id: string): Promise<void>;
  history(id: string): Promise<RevisionSummary[]>;
  revision(id: string, revision: number): Promise<Revision>;
  details(id: string): Promise<{ resume: Resume; history: RevisionSummary[] }>;
}
export function getStore(token: string): Store {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL)
    throw new Error("Configure NEXT_PUBLIC_CONVEX_URL through Infisical");
  const queryClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
    fetch: createConvexFetch({ deadlineMs: 8_000 }),
  });
  const mutationClient = new ConvexHttpClient(
    process.env.NEXT_PUBLIC_CONVEX_URL,
    {
      fetch: createConvexFetch(),
    },
  );
  queryClient.setAuth(token);
  mutationClient.setAuth(token);
  const query = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation("query", () =>
      queryClient.query(
        makeFunctionReference<"query", { op: string; payload: string }, T>(
          "workspace:read",
        ),
        { op, payload: JSON.stringify(args) },
      ),
    );
  const mutate = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation("mutation", () =>
      mutationClient.mutation(
        makeFunctionReference<"mutation", { op: string; payload: string }, T>(
          "workspace:write",
        ),
        { op, payload: JSON.stringify(args) },
      ),
    );
  return {
    list: () => query<ResumeSummary[]>("list"),
    get: (id) => query<Resume>("get", { id }),
    create: (input) => mutate<Resume>("create", input),
    save: (input) => mutate<Resume>("save", input),
    remove: (id) => mutate<void>("remove", { id }),
    history: (id) => query<RevisionSummary[]>("history", { id }),
    details: (id) =>
      query<unknown>("details", { id }).then((value) =>
        z
          .object({
            resume: resumeSchema,
            history: z.array(revisionSummarySchema),
          })
          .parse(value),
      ),
    revision: (id, revision) => query<Revision>("revision", { id, revision }),
  };
}
export type SaveInput = {
  id: string;
  baseDigest: string;
  expectedRevision: number;
  source: string;
  engine: Engine;
  name?: string;
  note?: string;
};
