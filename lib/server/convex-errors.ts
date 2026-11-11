import { setTimeout as delay } from "node:timers/promises";
import { isKnownTransportFailure } from "./transport-error";
import { ConvexDeadlineError } from "./convex-fetch";
import { reportUpstreamError } from "./upstream-diagnostics";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { DomainError } from "../core/model";
const errorData = z
  .object({
    kind: z.literal("resume-tex"),
    status: z.number().int().min(400).max(499),
    code: z.enum([
      "unauthenticated",
      "not_found",
      "conflict",
      "invalid",
      "limit",
    ]),
    message: z.string().min(1).max(300),
  })
  .strict();
export function mapConvexError(error: unknown): DomainError | undefined {
  if (!(error instanceof ConvexError)) return;
  const parsed = errorData.safeParse(error.data);
  if (parsed.success)
    return new DomainError(parsed.data.message, parsed.data.status);
}
export async function convexOperation<T>(
  operationKind: "query" | "mutation",
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  for (const attempt of [1, 2] as const) {
    try {
      const value = await operation();
      if (attempt === 2)
        console.error(
          JSON.stringify({
            event: "upstream_recovered",
            service: "convex",
            operationKind,
            attempts: 2,
            elapsedMs: Date.now() - startedAt,
          }),
        );
      return value;
    } catch (error) {
      const mapped = mapConvexError(error);
      if (mapped) throw mapped;
      const transportFailure =
        error instanceof ConvexDeadlineError || isKnownTransportFailure(error);
      const retry =
        operationKind === "query" && transportFailure && attempt === 1;
      reportUpstreamError("convex", error, startedAt, {
        operationKind,
        attempt,
        transportFailure,
        outcome: retry
          ? "retrying"
          : operationKind === "query" && transportFailure
            ? "exhausted"
            : "not_retried",
      });
      if (retry) {
        await delay(100);
        continue;
      }
      if (transportFailure)
        throw new DomainError(
          operationKind === "query"
            ? error instanceof ConvexDeadlineError
              ? "Storage read timed out. Try again shortly."
              : "Storage read is temporarily unavailable. Try again shortly."
            : "The change may have been saved. Download any unsaved source before refreshing to check the latest state.",
          503,
        );
      throw error;
    }
  }
  throw new DomainError(
    "Storage is temporarily unavailable. Try again shortly.",
    503,
  );
}
