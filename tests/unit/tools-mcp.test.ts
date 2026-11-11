import { test, expect } from "bun:test";
import { LocalStore } from "../fixtures/local-store";
import { buildProposal, executeTool } from "../../lib/server/tools";
import { templates } from "../fixtures/templates";
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
test.skip("external authenticated MCP e2e requires MCP_CLERK_TOKEN and MCP_RESUME_ID", () => {});
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
test("job tailoring ignores macro definitions and reorders actual adjacent bullet evidence", async () => {
  const { applyEdits } = await import("../../lib/core/model");
  const { compile, readArtifact } = await import("../../lib/server/compiler");
  const { extractPdf } = await import("../../lib/server/pdf-text");
  const proposal = buildProposal(sample, {
    tool: "tailor_to_job",
    jobDescription: "Required React component testing and accessible workflows",
  });
  expect(proposal.edits[0].expected).not.toContain("newcommand");
  const next = applyEdits(sample.source, proposal.edits);
  expect(next.indexOf("Maintained React")).toBeLessThan(
    next.indexOf("Built a TypeScript"),
  );
  expect(next).toContain("120 teammates");
  expect(next).toContain("35\\%");
  const compiled = await compile("tailoring", next, sample.engine);
  if (!compiled.ok) throw Error(compiled.log);
  const pdf = await extractPdf(
    await readArtifact("tailoring", compiled.artifact),
  );
  expect(pdf.text.indexOf("Maintained React")).toBeLessThan(
    pdf.text.indexOf("Built a TypeScript"),
  );
}, 15_000);

test("skill claims use token boundaries in both proposals and supporting evidence", () => {
  const start = sample.source.indexOf("Built a");
  const call = {
    tool: "rewrite_bullet" as const,
    start,
    end: start + 7,
    replacement: "Supported ongoing review and trust",
  };
  expect(() => buildProposal(sample, call)).not.toThrow();
  for (const skill of ["Go", "Rust"]) {
    expect(() =>
      buildProposal(sample, { ...call, replacement: "Used " + skill }),
    ).toThrow("unsupported skill");
    expect(() =>
      buildProposal(
        { ...sample, source: sample.source + "\n% ongoing review and trust" },
        { ...call, replacement: "Used " + skill },
      ),
    ).toThrow("unsupported skill");
    expect(() =>
      buildProposal(
        { ...sample, source: sample.source + "\n% Verified skill: " + skill },
        { ...call, replacement: "Used " + skill },
      ),
    ).not.toThrow();
  }
});
