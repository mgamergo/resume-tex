export function reportUpstreamError(
  service: "clerk" | "convex" | "model",
  error: unknown,
  startedAt: number,
) {
  const codes: string[] = [];
  const addCode = (value: unknown) => {
    if (
      typeof value === "string" &&
      /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value) &&
      !/^(?:sk_|pk_|eyJ)/.test(value)
    )
      codes.push(value);
  };
  let status: number | null = null;
  let current = error;
  for (
    let depth = 0;
    depth < 4 && typeof current === "object" && current !== null;
    depth++
  ) {
    if ("code" in current) addCode(current.code);
    if (
      "status" in current &&
      typeof current.status === "number" &&
      Number.isInteger(current.status) &&
      current.status >= 100 &&
      current.status <= 599
    )
      status = current.status;
    if ("errors" in current && Array.isArray(current.errors)) {
      for (const entry of current.errors.slice(0, 8))
        if (typeof entry === "object" && entry !== null && "code" in entry)
          addCode(entry.code);
    }
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
      status,
      codes: [...new Set(codes)].slice(0, 8),
    }),
  );
}
