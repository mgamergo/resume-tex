import { test, expect } from "bun:test";
import {
  createConvexFetch,
  ConvexDeadlineError,
} from "../../lib/server/convex-fetch";
import { convexOperation } from "../../lib/server/convex-errors";
test("Convex deadlines start per fetch, include the body, preserve caller aborts and never replay", async () => {
  let calls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      calls++;
      if (new URL(request.url).pathname === "/fast")
        return Response.json({ ok: true });
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"pending":'));
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  try {
    const base = `http://127.0.0.1:${server.port}`;
    const bounded = createConvexFetch({ deadlineMs: 100 });
    await Bun.sleep(120);
    expect(await (await bounded(base + "/fast")).json()).toEqual({ ok: true });
    expect(calls).toBe(1);
    await expect(
      createConvexFetch({ deadlineMs: 50 })(base + "/stall"),
    ).rejects.toBeInstanceOf(ConvexDeadlineError);
    expect(calls).toBe(2);
    for (const placement of ["init", "request"]) {
      const abort = new AbortController();
      const request =
        placement === "request"
          ? new Request(base + "/stall", { signal: abort.signal })
          : base + "/stall";
      const pending = createConvexFetch({ deadlineMs: 200 })(
        request,
        placement === "init" ? { signal: abort.signal } : undefined,
      );
      const timer = setTimeout(() => abort.abort(), 10);
      try {
        await expect(pending).rejects.not.toBeInstanceOf(ConvexDeadlineError);
      } finally {
        clearTimeout(timer);
      }
    }
    expect(calls).toBe(4);
  } finally {
    server.stop(true);
  }
});
test("query timeouts are retryable reads while mutation timeouts explicitly preserve unknown outcome", async () => {
  let calls = 0;
  for (const kind of ["query", "mutation"] satisfies ("query" | "mutation")[]) {
    try {
      await convexOperation(kind, async () => {
        calls++;
        throw new ConvexDeadlineError(new Error("fixture deadline"));
      });
      throw new Error("Deadline did not fail");
    } catch (error) {
      expect(error).toMatchObject({ status: 503 });
      if (!(error instanceof Error)) throw error;
      expect(error.message).toContain(
        kind === "query" ? "Try again" : "may have been saved",
      );
      if (kind === "mutation")
        expect(error.message).toContain(
          "Download any unsaved source before refreshing",
        );
    }
  }
  expect(calls).toBe(3);
});
test("only idempotent queries recover once, never structured errors, HTTP errors, caller aborts or mutations", async () => {
  let calls = 0;
  expect(
    await convexOperation("query", async () => {
      if (++calls === 1) throw new ConvexDeadlineError(new Error());
      return "recovered";
    }),
  ).toBe("recovered");
  expect(calls).toBe(2);
  calls = 0;
  expect(
    await convexOperation("query", async () => {
      if (++calls === 1)
        throw Object.assign(new TypeError("fetch failed"), {
          cause: { code: "ECONNRESET" },
        });
      return "recovered";
    }),
  ).toBe("recovered");
  expect(calls).toBe(2);
  for (const kind of ["query", "mutation"] as const) {
    for (const error of [
      new DOMException("caller cancelled", "AbortError"),
      Object.assign(new Error("fetch failed"), { status: 429 }),
      Object.assign(new Error("fetch failed"), { status: 503 }),
    ]) {
      calls = 0;
      await expect(
        convexOperation(kind, async () => {
          calls++;
          throw error;
        }),
      ).rejects.toBe(error);
      expect(calls).toBe(1);
    }
  }
  calls = 0;
  await expect(
    convexOperation("mutation", async () => {
      calls++;
      throw new ConvexDeadlineError(new Error());
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(calls).toBe(1);
});

test("known native read failures exhaust at two calls and writes stop at one with unknown outcome", async () => {
  for (const kind of ["query", "mutation"] as const) {
    let calls = 0;
    await expect(
      convexOperation(kind, async () => {
        calls++;
        throw Object.assign(new TypeError("fetch failed"), {
          cause: { code: "ECONNRESET" },
        });
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(kind === "query" ? 2 : 1);
  }
});
