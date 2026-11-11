import { test, expect } from "bun:test";
import { extractPdf, pdfExtractionPolicy } from "../../lib/server/pdf-text";
import { compile, readArtifact } from "../../lib/server/compiler";
test("PDF worker rejects oversized input, kills deadline work and recovers the queue", async () => {
  await expect(
    extractPdf(new Uint8Array(pdfExtractionPolicy.maxInputBytes + 1)),
  ).rejects.toThrow("input limit");
  const previous = pdfExtractionPolicy.wallMs;
  try {
    pdfExtractionPolicy.wallMs = 1;
    await expect(extractPdf(new Uint8Array([37, 80, 68, 70]))).rejects.toThrow(
      "time or output",
    );
  } finally {
    pdfExtractionPolicy.wallMs = previous;
  }
  const compiled = await compile(
    "pdf-worker-test",
    "\\documentclass{article}\\begin{document}Bounded extraction works.\\end{document}",
    "pdflatex",
  );
  if (!compiled.ok) throw new Error(compiled.log);
  const pdf = await extractPdf(
    await readArtifact("pdf-worker-test", compiled.artifact),
  );
  expect(pdf.text).toContain("Bounded extraction works.");
}, 15_000);
