import { convexOperation } from "./convex-errors";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  Engine,
  Proposal,
  ProposalInput,
  Resume,
  ResumeSummary,
  Revision,
  RevisionSummary,
} from "../core/model";
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
  propose(id: string, input: ProposalInput): Promise<Proposal>;
  proposals(id: string): Promise<Proposal[]>;
  decide(id: string, proposalId: string, accept: boolean): Promise<Resume>;
}
export function getStore(token: string): Store {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL)
    throw new Error("Configure NEXT_PUBLIC_CONVEX_URL through Infisical");
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(token);
  const query = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation("query", () =>
      client.query(
        makeFunctionReference<"query", { op: string; payload: string }, T>(
          "workspace:read",
        ),
        { op, payload: JSON.stringify(args) },
      ),
    );
  const mutate = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation("mutation", () =>
      client.mutation(
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
    propose: (id, input) => mutate<Proposal>("propose", { id, input }),
    revision: (id, revision) => query<Revision>("revision", { id, revision }),
    proposals: (id) => query<Proposal[]>("proposals", { id }),
    decide: (id, proposalId, accept) =>
      mutate<Resume>("decide", { id, proposalId, accept }),
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
