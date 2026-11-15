import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";
import { createConvexFetch } from "./convex-fetch";
import { convexOperation } from "./convex-errors";
import {
  resumeSchema,
  resumeSummarySchema,
  revisionSchema,
} from "../core/schemas";
import { saveDocumentSchema } from "../core/mcp";

export function getAgentStore(apiKey: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Configure NEXT_PUBLIC_CONVEX_URL");
  const client = new ConvexHttpClient(url, {
    fetch: createConvexFetch({ deadlineMs: 8000 }),
  });
  const read = (op: string, payload: object = {}) =>
    convexOperation("query", () =>
      client.mutation(
        makeFunctionReference<"mutation">("workspace:agentRead"),
        {
          apiKey,
          op,
          payload: JSON.stringify(payload),
        },
      ),
    );
  return {
    authenticate: () =>
      read("authenticate").then((value) =>
        z.object({ owner: z.string() }).parse(value),
      ),
    list: () =>
      read("list").then((value) => z.array(resumeSummarySchema).parse(value)),
    get: (id: string) =>
      read("get", { id }).then((value) => resumeSchema.parse(value)),
    revision: (id: string, revision: number) =>
      read("revision", { id, revision }).then((value) =>
        revisionSchema.parse(value),
      ),
    save: (input: z.infer<typeof saveDocumentSchema>) =>
      convexOperation("mutation", () =>
        client.mutation(
          makeFunctionReference<"mutation">("workspace:agentWrite"),
          { apiKey, payload: JSON.stringify(saveDocumentSchema.parse(input)) },
        ),
      ).then((value) => resumeSchema.parse(value)),
  };
}
export type AgentStore = ReturnType<typeof getAgentStore>;
