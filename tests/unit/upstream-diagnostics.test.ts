import { test, expect, spyOn } from "bun:test";
import { reportUpstreamError } from "../../lib/server/upstream-diagnostics";
test("upstream telemetry keeps error messages requests headers and tokens out of logs", () => {
  const logged: string[] = [];
  const spy = spyOn(console, "error").mockImplementation((value: unknown) =>
    logged.push(String(value)),
  );
  try {
    const secret = "private-header-and-ticket";
    const error = Object.assign(
      new Error(secret, {
        cause: Object.assign(new Error(secret), {
          code: "ECONNRESET",
          headers: { Authorization: secret },
        }),
      }),
      { status: 404, errors: [{ code: "session_not_found", message: secret }] },
    );
    reportUpstreamError("convex", error, Date.now());
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0])).toMatchObject({
      event: "upstream_error",
      service: "convex",
      name: "Error",
      status: 404,
      codes: ["session_not_found", "ECONNRESET"],
    });
    expect(logged[0]).not.toContain(secret);
    expect(logged[0]).not.toContain("Authorization");
  } finally {
    spy.mockRestore();
  }
});
