import { test, expect } from "bun:test";
import { templates } from "../../lib/core/templates";
import { compile, readArtifact } from "../../lib/server/compiler";
import { extractPdf } from "../fixtures/pdf-text";
for (const template of templates) {
  test(`blank ${template.name} compiles with its intended engine and no career claims`, async () => {
    expect(template.source).not.toMatch(
      /Alex|Morgan|Example Labs|TypeScript|120 teammates|2017|555-/,
    );
    const result = await compile(
      "blank-starters",
      template.source,
      template.engine,
    );
    if (!result.ok) throw new Error(result.log);
    const pdf = await extractPdf(
      await readArtifact("blank-starters", result.artifact),
    );
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain("Experience");
    expect(pdf.text).toContain("Education");
    expect(pdf.text).not.toMatch(/Alex|Morgan|TypeScript|Example Labs/);
  }, 30_000);
}
test("Jake-compatible fullpage package is available inside the real compiler sandbox", async () => {
  const result = await compile(
    "fullpage-regression",
    String.raw`\documentclass{article}
\usepackage{fullpage}
\begin{document}Fullpage package verified.\end{document}`,
    "pdflatex",
  );
  if (!result.ok) throw new Error(result.log);
  const pdf = await extractPdf(
    await readArtifact("fullpage-regression", result.artifact),
  );
  expect(pdf.text).toContain("Fullpage package verified.");
});
