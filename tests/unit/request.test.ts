import { test, expect } from "bun:test";
import { scope, readJson } from "../../lib/server/request";
test("request origin validation rejects cross-origin access before authentication", async () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://resume.example";
  try {
    await expect(
      scope(
        new Request("http://localhost:3100/api/workspace", {
          headers: { host: "127.0.0.1:3100", origin: "https://evil.example" },
        }),
      ),
    ).rejects.toThrow("Cross-origin");
    await expect(
      scope(
        new Request("http://localhost:3100/api/workspace", {
          headers: {
            host: "evil.example:3100",
            origin: "http://evil.example:3100",
          },
        }),
      ),
    ).rejects.toThrow("Cross-origin");
    await expect(
      scope(
        new Request("http://localhost:3100/api/workspace", {
          headers: {
            origin: "https://resume.example",
            "content-length": "512001",
          },
        }),
      ),
    ).rejects.toThrow("512 KB");
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});
test("length-less streamed JSON is canceled at the byte bound", async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(100_000));
    },
    cancel() {
      canceled = true;
    },
  });
  const request = new Request("http://localhost/api", {
    method: "POST",
    body: stream,
  });
  await expect(readJson(request)).rejects.toThrow("512 KB");
  expect(canceled).toBe(true);
});
