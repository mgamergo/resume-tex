import { beforeAll, afterAll, test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../lib/server/mcp";
import { LocalStore } from "../fixtures/local-store";
import { templates } from "../fixtures/templates";
import { resumeSchema } from "../../lib/core/schemas";
import { extractPdf } from "../fixtures/pdf-text";
import { z } from "zod";
let directory = "";
let previous: string | undefined;
beforeAll(async () => {
  previous = process.env.DATA_DIR;
  directory = await mkdtemp(join(tmpdir(), "mcp-test-"));
  process.env.DATA_DIR = directory;
});
afterAll(async () => {
  if (previous === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previous;
  await rm(directory, { recursive: true, force: true });
});
test("actual MCP protocol reads/writes/exports, rejects stale writes and returns real PDF bytes", async () => {
  const store = new LocalStore("mcp-owner");
  const doc = await store.create({
    name: "MCP",
    source: templates[0].source,
    engine: templates[0].engine,
    template: "jake",
  });
  const other = new LocalStore("foreign");
  const foreign = await other.create({
    name: "Foreign",
    source: doc.source,
    engine: doc.engine,
    template: "jake",
  });
  const server = createMcpServer({
    authenticate: async () => ({ owner: "mcp-owner" }),
    get: (id) => store.get(id),
    list: () => store.list(),
    save: (input) => store.save(input),
    revision: (id, revision) => store.revision(id, revision),
    create: async (input) => {
      const template = templates.find(
        (template) => template.id === input.template,
      );
      if (!template) throw new Error("Template not found");
      return store.create({
        ...template,
        name: input.name,
        template: template.id,
      });
    },
  });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a);
    await client.connect(b);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "list_templates",
      "create_document",
      "list_documents",
      "read_document",
      "write_document",
      "patch_document",
      "export_source",
      "compile_pdf",
    ]);
    const result = await client.callTool({
      name: "read_document",
      arguments: { id: doc.id },
    });
    const text = z
      .object({
        content: z.array(
          z.object({ type: z.literal("text"), text: z.string() }),
        ),
      })
      .parse(result).content[0].text;
    expect(resumeSchema.parse(JSON.parse(text))).toEqual(doc);
    const args = {
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      source: doc.source.replace("Alex Morgan", "MCP Verified"),
      engine: doc.engine,
    };
    expect(
      (await client.callTool({ name: "write_document", arguments: args }))
        .isError,
    ).not.toBe(true);
    expect((await store.get(doc.id)).source).toContain("MCP Verified");
    expect(
      (await client.callTool({ name: "write_document", arguments: args }))
        .isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: "read_document",
          arguments: { id: foreign.id },
        })
      ).isError,
    ).toBe(true);
    const exported = z
      .object({
        content: z.array(
          z.object({
            type: z.literal("resource"),
            resource: z.object({ text: z.string(), mimeType: z.string() }),
          }),
        ),
      })
      .parse(
        await client.callTool({
          name: "export_source",
          arguments: { id: doc.id },
        }),
      );
    expect(exported.content[0].resource.text).toBe(args.source);
    const compiled = z
      .object({
        content: z.array(
          z.object({ type: z.literal("text"), text: z.string() }),
        ),
      })
      .parse(
        await client.callTool({
          name: "compile_pdf",
          arguments: { id: doc.id },
        }),
      );
    const metadata = z
      .object({ ok: z.literal(true), uri: z.string(), revision: z.number() })
      .parse(JSON.parse(compiled.content[0].text));
    expect(metadata.revision).toBe(2);
    const resource = z
      .object({
        contents: z.array(
          z.object({
            mimeType: z.literal("application/pdf"),
            blob: z.string(),
          }),
        ),
      })
      .parse(await client.readResource({ uri: metadata.uri }));
    const bytes = Buffer.from(resource.contents[0].blob, "base64");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await extractPdf(bytes)).text).toContain("MCP Verified");
    await expect(
      client.readResource({ uri: metadata.uri.replace("/2/", "/1/") }),
    ).rejects.toThrow();
  } finally {
    await client.close();
    await server.close();
  }
}, 60000);
