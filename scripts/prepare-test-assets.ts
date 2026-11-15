const result = await Bun.build({
  entrypoints: ["tests/fixtures/pdf-worker.ts"],
  target: "node",
  external: ["pdfjs-dist"],
  outdir: ".tools",
  naming: "pdf-worker.mjs",
});
if (!result.success)
  throw new Error(result.logs.map((log) => log.message).join("\n"));
export {};
