import { test, expect } from "bun:test";
import { scope, readJson } from "../../lib/server/request";
test("request validation uses external Host when Next internally normalizes URL and rejects rebinding/origin mismatch", async () => {
  process.env.APP_MODE = "local";
  await expect(
    scope(
      new Request("http://localhost:3100/api/workspace", {
        headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
      }),
    ),
  ).resolves.toHaveProperty("owner", "local-workspace");
  await expect(
    scope(
      new Request("http://localhost:3100/api/workspace", {
        headers: {
          host: "evil.example:3100",
          origin: "http://evil.example:3100",
        },
      }),
    ),
  ).rejects.toThrow("loopback");
  await expect(
    scope(
      new Request("http://localhost:3100/api/workspace", {
        headers: { host: "localhost:3100", origin: "http://evil.example" },
      }),
    ),
  ).rejects.toThrow("Cross-origin");
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
