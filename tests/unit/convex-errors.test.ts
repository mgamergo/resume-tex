import { test, expect } from "bun:test";
import { ConvexError } from "convex/values";
import {
  mapConvexError,
  convexOperation,
} from "../../lib/server/convex-errors";
test("expected structured Convex wire errors retain HTTP semantics while unknown errors stay unexpected", async () => {
  for (const [status, code, message] of [
    [401, "unauthenticated", "Authentication required"],
    [404, "not_found", "Resume not found"],
    [409, "conflict", "Revision conflict"],
    [409, "conflict", "Stale proposal"],
  ] satisfies [number, string, string][]) {
    const error = new ConvexError({
      kind: "resume-tex",
      status,
      code,
      message,
    });
    expect(mapConvexError(error)?.status).toBe(status);
    expect(mapConvexError(error)?.message).toBe(message);
    await expect(
      convexOperation("query", async () => {
        throw error;
      }),
    ).rejects.toHaveProperty("status", status);
  }
  expect(mapConvexError(new Error("Revision conflict"))).toBeUndefined();
  expect(
    mapConvexError(
      new ConvexError({
        kind: "unexpected",
        status: 409,
        message: "do not remap",
      }),
    ),
  ).toBeUndefined();
  expect(
    mapConvexError(
      new ConvexError({
        kind: "resume-tex",
        status: 500,
        code: "conflict",
        message: "bad payload",
      }),
    ),
  ).toBeUndefined();
});

test("Convex business errors never replay even when transport wording is present", async () => {
  for (const error of [
    new ConvexError("fetch failed"),
    new ConvexError({
      kind: "resume-tex",
      status: 409,
      code: "conflict",
      message: "fetch failed",
    }),
  ]) {
    let calls = 0;
    await expect(
      convexOperation("query", async () => {
        calls++;
        throw error;
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(calls).toBe(1);
  }
});
