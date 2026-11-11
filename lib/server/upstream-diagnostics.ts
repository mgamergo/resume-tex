export function reportUpstreamError(
  service: "clerk" | "convex" | "model",
  error: unknown,
  startedAt: number,
) {
  const codes: string[] = [];
  let current = error;
  for (
    let depth = 0;
    depth < 4 && typeof current === "object" && current !== null;
    depth++
  ) {
    if (
      "code" in current &&
      typeof current.code === "string" &&
      /^[A-Z][A-Z0-9_]{0,63}$/.test(current.code)
    )
      codes.push(current.code);
    current = "cause" in current ? current.cause : undefined;
  }
  console.error(
    JSON.stringify({
      event: "upstream_error",
      service,
      elapsedMs: Date.now() - startedAt,
      name:
        error instanceof Error &&
        /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
          ? error.name
          : "Error",
      codes,
    }),
  );
}
