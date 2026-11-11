import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LocalStore } from "../../lib/server/local-store";
import { buildProposal, executeTool } from "../../lib/server/tools";
import { templates } from "../../lib/core/templates";
import { digest } from "../../lib/core/digest";
const sample = {
  ...templates[0],
  id: "sample",
  name: "Sample",
  template: "jake",
  digest: digest(templates[0].source),
  revision: 1,
  updatedAt: 0,
};
test("structured tools refuse full rewrites, multiline bullets and invented metrics", () => {
  expect(() =>
    buildProposal(sample, {
      tool: "range_patch",
      title: "Rewrite",
      edits: [
        {
          start: 0,
          end: sample.source.length,
          expected: sample.source,
          replacement: "New document",
        },
      ],
    }),
  ).toThrow("targeted");
  expect(() =>
    buildProposal(sample, {
      tool: "rewrite_bullet",
      start: 0,
      end: sample.source.length,
      replacement: "New document",
    }),
  ).toThrow("single bullet");
  const start = sample.source.indexOf("Built a");
  expect(() =>
    buildProposal(sample, {
      tool: "rewrite_bullet",
      start,
      end: start + 7,
      replacement: "Built 999",
    }),
  ).toThrow("unsupported number");
});
test("a provider's old offsets cannot be rebound onto newer source", async () => {
  const store = new LocalStore("provider-race");
  const doc = await store.create({
    name: "Race",
    source: sample.source,
    engine: sample.engine,
    template: "jake",
  });
  const start = doc.source.indexOf("Built a");
  const planned = {
    tool: "rewrite_bullet" as const,
    start,
    end: start + 7,
    replacement: "Built a",
  };
  await store.save({
    id: doc.id,
    baseDigest: doc.digest,
    expectedRevision: doc.revision,
    source: "% New prefix\n" + doc.source,
    engine: doc.engine,
  });
  await expect(executeTool(store, doc.id, planned, doc.digest)).rejects.toThrow(
    "Document changed",
  );
  expect(await store.proposals(doc.id)).toEqual([]);
});
test("real MCP stdio initialize/list/read/propose, stale base rejection, and UI-only approval", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "resume-mcp-"));
  let client: Client | undefined;
  try {
    const seeded = spawnSync(
      process.execPath,
      [
        "-e",
        'import {LocalStore} from "./lib/server/local-store";import {templates} from "./lib/core/templates";const t=templates[0];const d=await new LocalStore("local-workspace").create({name:"MCP",source:t.source,engine:t.engine,template:t.id});console.log(JSON.stringify(d));',
      ],
      {
        cwd: process.cwd(),
        env: {
          NODE_ENV: "test",
          PATH: process.env.PATH,
          APP_MODE: "local",
          DATA_DIR: dataDir,
        },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(seeded.status).toBe(0);
    const doc = z
      .object({ id: z.string(), digest: z.string() })
      .parse(JSON.parse(seeded.stdout));
    client = new Client({ name: "resume-test", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ["scripts/mcp.ts"],
        cwd: process.cwd(),
        env: {
          PATH: process.env.PATH ?? "",
          APP_MODE: "local",
          AI_PROVIDER: "mock",
          DATA_DIR: dataDir,
          MCP_RESUME_ID: doc.id,
        },
      }),
    );
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "propose_edit",
      "read_document",
    ]);
    const read = await client.callTool({
      name: "read_document",
      arguments: {},
    });
    expect(JSON.stringify(read)).toContain("Alex Morgan");
    const proposed = await client.callTool({
      name: "propose_edit",
      arguments: {
        baseDigest: doc.digest,
        call: {
          tool: "range_patch",
          title: "MCP proposal",
          edits: [
            { start: 0, end: 0, expected: "", replacement: "% review\n" },
          ],
        },
      },
    });
    expect(proposed.isError).not.toBe(true);
    expect(JSON.stringify(proposed)).toContain("pending");
    const reread = await client.callTool({
      name: "read_document",
      arguments: {},
    });
    expect(JSON.stringify(reread)).not.toContain("% review");
    const stale = await client.callTool({
      name: "propose_edit",
      arguments: {
        baseDigest: "0".repeat(64),
        call: { tool: "rewrite_bullet", start: 0, end: 1, replacement: "x" },
      },
    });
    expect(stale.isError).toBe(true);
  } finally {
    await client?.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}, 20_000);
test("supported column flattening preserves facts and compiles a one-column actual PDF", async () => {
  const { applyEdits } = await import("../../lib/core/model");
  const { compile, readArtifact } = await import("../../lib/server/compiler");
  const { extractPdf } = await import("../../lib/server/pdf-text");
  for (const template of templates.filter(
    (t) => t.id === "deedy" || t.id === "alta",
  )) {
    const doc = {
      ...template,
      id: "columns",
      template: template.id,
      digest: digest(template.source),
      revision: 1,
      updatedAt: 0,
    };
    const proposal = buildProposal(doc, { tool: "flatten_columns" });
    expect(proposal.edits).toHaveLength(4);
    const next = applyEdits(doc.source, proposal.edits);
    expect(next).not.toContain("minipage");
    const result = await compile("columns", next, template.engine);
    if (!result.ok) throw Error(result.log);
    const pdf = await extractPdf(
      await readArtifact("columns", result.artifact),
    );
    expect(pdf.text).toContain("120");
    expect(pdf.text).toContain("Example Labs");
    expect(pdf.columns).toBe(false);
  }
}, 30_000);
test("new metrics require explicit author evidence rather than model invention", () => {
  const start = sample.source.indexOf("Built a");
  expect(() =>
    buildProposal(sample, {
      tool: "rewrite_bullet",
      start,
      end: start + 7,
      replacement: "Built 999",
    }),
  ).toThrow("unsupported number");
  expect(
    buildProposal(
      sample,
      {
        tool: "rewrite_bullet",
        start,
        end: start + 7,
        replacement: "Built 999",
      },
      "I can verify that I built 999",
    ).edits[0].replacement,
  ).toBe("Built 999");
});
