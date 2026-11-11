import { test, expect } from "bun:test";
import {
  CompatibleProvider,
  parseProviderCall,
} from "../../lib/server/provider";
import { templates } from "../../lib/core/templates";
import { digest } from "../../lib/core/digest";
test("compatible provider sends a real function-call HTTP request and validates returned structured arguments", async () => {
  const previous = {
    url: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    key: process.env.AI_API_KEY,
  };
  let received: unknown;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      received = await request.json();
      return Response.json({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "propose_edit",
                    arguments: JSON.stringify({
                      call: { tool: "read_document" },
                    }),
                  },
                },
              ],
            },
          },
        ],
      });
    },
  });
  try {
    process.env.AI_BASE_URL = `http://127.0.0.1:${server.port}/v1`;
    process.env.AI_MODEL = "fixture-model";
    process.env.AI_API_KEY = "fixture-only-not-a-secret";
    const t = templates[0];
    const call = await new CompatibleProvider().plan(
      {
        ...t,
        id: "fixture",
        template: t.id,
        digest: digest(t.source),
        revision: 1,
        updatedAt: 0,
      },
      "Read the source",
      { jobDescription: "", log: "" },
    );
    expect(call).toEqual({ tool: "read_document" });
    expect(JSON.stringify(received)).toContain('"type":"function"');
    expect(JSON.stringify(received)).toContain('"type":"object"');
    expect(JSON.stringify(received)).toContain("fixture-model");
  } finally {
    server.stop(true);
    for (const [key, value] of Object.entries({
      AI_BASE_URL: previous.url,
      AI_MODEL: previous.model,
      AI_API_KEY: previous.key,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("provider exact selectors resolve Unicode in the immutable snapshot and reject empty missing ambiguous or overlapping edits", () => {
  const source = "😀 header\nA unique bullet.\nRepeated. Repeated.";
  const call = parseProviderCall(source, {
    tool: "rewrite_bullet",
    expected: "A unique bullet.",
    replacement: "A clearer bullet.",
  });
  expect(call).toEqual({
    tool: "rewrite_bullet",
    start: 10,
    end: 26,
    replacement: "A clearer bullet.",
  });
  for (const expected of ["", "missing", "Repeated."])
    expect(() =>
      parseProviderCall(source, {
        tool: "rewrite_bullet",
        expected,
        replacement: "changed",
      }),
    ).toThrow();
  expect(() =>
    parseProviderCall("prefix " + source, {
      tool: "rewrite_bullet",
      expected: "missing",
      replacement: "changed",
    }),
  ).toThrow();
  expect(() =>
    parseProviderCall(source, {
      tool: "range_patch",
      title: "Overlap",
      edits: [
        { expected: "A unique bullet.", replacement: "a" },
        { expected: "unique bullet", replacement: "b" },
      ],
    }),
  ).toThrow();
});
