import { isKnownTransportFailure } from "./transport-error";
import { setTimeout as delay } from "node:timers/promises";
import { DomainError } from "../core/model";
import { reportUpstreamError } from "./upstream-diagnostics";
export async function acquireSessionToken(
  supplier: () => Promise<string | null>,
  signal: AbortSignal,
) {
  const startedAt = Date.now();
  for (const attempt of [1, 2] as const) {
    signal.throwIfAborted();
    try {
      const token = await supplier();
      if (attempt === 2)
        console.error(
          JSON.stringify({
            event: "upstream_recovered",
            service: "clerk",
            attempts: 2,
            elapsedMs: Date.now() - startedAt,
          }),
        );
      return token;
    } catch (error) {
      const transportFailure = isKnownTransportFailure(error);
      const retry = transportFailure && !signal.aborted && attempt === 1;
      reportUpstreamError("clerk", error, startedAt, {
        requestAborted: signal.aborted,
        attempt,
        transportFailure,
        outcome: retry
          ? "retrying"
          : transportFailure && !signal.aborted
            ? "exhausted"
            : "not_retried",
      });
      signal.throwIfAborted();
      if (retry) {
        await delay(100, undefined, { signal });
        continue;
      }
      if (transportFailure && !signal.aborted)
        throw new DomainError(
          "Sign-in service is temporarily unavailable. Try again shortly; your unsaved source remains on this page.",
          503,
        );
      throw error;
    }
  }
  throw new DomainError(
    "Sign-in service is temporarily unavailable. Try again shortly.",
    503,
  );
}
