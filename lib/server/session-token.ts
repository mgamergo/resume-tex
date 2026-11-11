import { setTimeout as delay } from "node:timers/promises";
import { DomainError } from "../core/model";
import { reportUpstreamError } from "./upstream-diagnostics";
export function isTokenTransportFailure(error: unknown): boolean {
  let known = false;
  let current = error;
  for (
    let depth = 0;
    depth < 4 && typeof current === "object" && current !== null;
    depth++
  ) {
    if (
      "status" in current &&
      typeof current.status === "number" &&
      current.status >= 100
    )
      return false;
    if (
      "code" in current &&
      ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(
        String(current.code),
      )
    )
      known = true;
    if ("message" in current && current.message === "fetch failed")
      known = true;
    if ("errors" in current && Array.isArray(current.errors)) {
      for (const entry of current.errors.slice(0, 8)) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          "code" in entry &&
          entry.code === "unexpected_error" &&
          "message" in entry &&
          entry.message === "fetch failed"
        )
          known = true;
      }
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return known;
}
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
      const transportFailure = isTokenTransportFailure(error);
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
