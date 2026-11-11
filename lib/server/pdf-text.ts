import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DomainError } from "../core/model";
import type { PdfText, PdfWord } from "../core/ats";
export async function extractPdf(bytes: Uint8Array): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const require = createRequire(import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
  });
  const document = await task.promise;
  try {
    if (document.numPages > 10)
      throw new DomainError("ATS analysis supports at most 10 pages");
    const words: PdfWord[] = [];
    let text = "";
    let columns = false;
    const lowTextPages: number[] = [];
    for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
      const page = await document.getPage(pageNo);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      let pageText = "";
      let previousY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const [, , , height, x, y] = item.transform;
        words.push({
          text: item.str,
          x,
          y,
          width: item.width,
          height: Math.abs(height),
          page: pageNo,
        });
        if (previousY !== undefined && Math.abs(y - previousY) > 3)
          pageText += "\n";
        else if (pageText && !pageText.endsWith("\n")) pageText += " ";
        pageText += item.str;
        previousY = y;
        if (item.hasEOL) pageText += "\n";
      }
      if (pageText.replace(/\s/g, "").length < 80) lowTextPages.push(pageNo);
      const bands = new Map<number, { left: boolean; right: boolean }>();
      for (const word of words.filter(
        (w) => w.page === pageNo && w.text.trim(),
      )) {
        const key = Math.round(word.y / 12);
        const band = bands.get(key) ?? { left: false, right: false };
        if (
          word.x < viewport.width * 0.4 &&
          word.x + word.width < viewport.width * 0.58
        )
          band.left = true;
        if (word.x > viewport.width * 0.58) band.right = true;
        bands.set(key, band);
      }
      if ([...bands.values()].filter((b) => b.left && b.right).length >= 5)
        columns = true;
      text += pageText.trim() + "\n\n";
      page.cleanup();
    }
    return {
      text: text.trim(),
      pages: document.numPages,
      words,
      columns,
      lowTextPages,
    };
  } finally {
    await task.destroy();
  }
}
