export function isKnownTransportFailure(error: unknown): boolean {
  let known = false;
  let current = error;
  for (
    let depth = 0;
    depth < 4 && typeof current === "object" && current !== null;
    depth++
  ) {
    if ("name" in current && current.name === "AbortError") return false;
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
