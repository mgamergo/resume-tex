import { copyFileSync, mkdirSync } from "node:fs";
copyFileSync(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
mkdirSync(".tools", { recursive: true });
const result = await Bun.build({
  entrypoints: ["scripts/pdf-worker.ts"],
  target: "node",
  external: ["pdfjs-dist"],
  outdir: ".tools",
  naming: "pdf-worker.mjs",
});
if (!result.success)
  throw new Error(result.logs.map((log) => log.message).join("\n"));
