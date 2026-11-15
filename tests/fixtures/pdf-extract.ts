import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
export async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    createRequire(import.meta.url).resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    ),
  ).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" "),
      );
      page.cleanup();
    }
    return { text: pages.join("\n"), pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}
