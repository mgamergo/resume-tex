import { convexOperation } from "./convex-errors";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { LocalStore } from "./local-store";
import type {
  Engine,
  Proposal,
  Resume,
  ResumeSummary,
  Revision,
  RevisionSummary,
} from "../core/model";
export type Store = Pick<
  LocalStore,
  | "list"
  | "get"
  | "create"
  | "save"
  | "remove"
  | "history"
  | "revision"
  | "propose"
  | "proposals"
  | "decide"
>;
export function getStore(owner: string, token?: string): Store {
  if (process.env.APP_MODE === "local") return new LocalStore(owner);
  if (
    process.env.APP_MODE !== "connected" ||
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
    !token
  )
    throw new Error(
      "Set APP_MODE=local explicitly, or configure Clerk and Convex for APP_MODE=connected.",
    );
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  client.setAuth(token);
  const query = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation(() =>
      client.query(
        makeFunctionReference<"query", { op: string; payload: string }, T>(
          "workspace:read",
        ),
        { op, payload: JSON.stringify(args) },
      ),
    );
  const mutate = <T>(op: string, args: Record<string, unknown> = {}) =>
    convexOperation(() =>
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
