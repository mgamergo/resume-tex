import { randomBytes, createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";
import { scope, failure, readJson } from "@/lib/server/request";
import { convexOperation } from "@/lib/server/convex-errors";
import { createConvexFetch } from "@/lib/server/convex-fetch";
import { DomainError } from "@/lib/core/model";
export const runtime = "nodejs";
async function keyClient(request: Request) {
  const { owner, token } = await scope(request);
  if (
    !process.env.MCP_OWNER_CLERK_ID ||
    owner !== process.env.MCP_OWNER_CLERK_ID
  )
    throw new DomainError(
      "MCP access is restricted to the configured owner",
      403,
    );
  if (!token || !process.env.NEXT_PUBLIC_CONVEX_URL)
    throw new DomainError("Authentication configuration unavailable", 503);
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
    fetch: createConvexFetch(),
  });
  client.setAuth(token);
  return client;
}
export async function GET(request: Request) {
  try {
    const client = await keyClient(request);
    return Response.json(
      {
        keys: await convexOperation("query", () =>
          client.query(makeFunctionReference<"query">("workspace:keys"), {}),
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const client = await keyClient(request);
    const input = z
      .discriminatedUnion("op", [
        z
          .object({
            op: z.literal("issue"),
            label: z.string().trim().min(1).max(60),
          })
          .strict(),
        z
          .object({ op: z.literal("revoke"), id: z.string().min(1).max(100) })
          .strict(),
      ])
      .parse(await readJson(request));
    if (input.op === "revoke") {
      await convexOperation("mutation", () =>
        client.mutation(
          makeFunctionReference<"mutation">("workspace:revokeKey"),
          { id: input.id },
        ),
      );
      return Response.json({ ok: true });
    }
    const secret = `rtx_${randomBytes(32).toString("hex")}`;
    const key = await convexOperation("mutation", () =>
      client.mutation(makeFunctionReference<"mutation">("workspace:issueKey"), {
        payload: JSON.stringify({
          label: input.label,
          keyHash: createHash("sha256").update(secret).digest("hex"),
          prefix: secret.slice(0, 12),
          expiresAt: Date.now() + 90 * 86400000,
        }),
      }),
    );
    return Response.json(
      { key, secret },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
