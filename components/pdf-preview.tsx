"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
function PdfPage({
  pdf,
  number,
  width,
  zoom,
  aspect,
  onTextClick,
  onError,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  zoom: number;
  aspect: number;
  onTextClick: (text: string) => void;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageAspect, setPageAspect] = useState(aspect);
  const click = useRef(onTextClick);
  useEffect(() => {
    click.current = onTextClick;
  }, [onTextClick]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      { rootMargin: "300px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const pageWidth = Math.max(120, Math.min(width - 32, 850) * zoom);
  useEffect(() => {
    const sheet = host.current;
    if (!visible || !sheet) return;
    let disposed = false;
    let cancel = () => {};
    let releasePage = () => {};
    const canvas = document.createElement("canvas");
    const render = async () => {
      try {
        const [page, pdfjs] = await Promise.all([
          pdf.getPage(number),
          import("pdfjs-dist"),
        ]);
        releasePage = () => {
          page.cleanup();
        };
        if (disposed) {
          releasePage();
          return;
        }
        const natural = page.getViewport({ scale: 1 });
        setPageAspect(natural.height / natural.width);
        const viewport = page.getViewport({ scale: pageWidth / natural.width });
        // Bound each visible page's backing bitmap, including on high-DPI screens.
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(4_000_000 / (viewport.width * viewport.height)),
        );
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.setAttribute("aria-label", `PDF page ${number}`);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        const layer = document.createElement("div");
        layer.className = "textLayer";
        layer.setAttribute("aria-label", `Selectable text page ${number}`);
        layer.addEventListener("dblclick", (event) => {
          if (event.target instanceof HTMLElement)
            click.current(event.target.textContent ?? "");
        });
        sheet.style.setProperty("--scale-factor", String(viewport.scale));
        sheet.style.setProperty("--total-scale-factor", String(viewport.scale));
        sheet.replaceChildren(canvas, layer);
        const task = page.render({
          canvasContext: context,
          canvas,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        cancel = () => task.cancel();
        await task.promise;
        if (disposed) return;
        const text = new pdfjs.TextLayer({
          textContentSource: await page.getTextContent(),
          container: layer,
          viewport,
        });
        if (disposed) return;
        cancel = () => text.cancel();
        await text.render();
        if (disposed) return;
        cancel = () => {};
      } catch (reason) {
        if (!disposed)
          onError(
            reason instanceof Error ? reason.message : "PDF rendering failed",
          );
      } finally {
        if (disposed) releasePage();
      }
    };
    void render();
    return () => {
      disposed = true;
      cancel();
      releasePage();
      canvas.width = 0;
      canvas.height = 0;
      sheet.replaceChildren();
    };
  }, [pdf, number, pageWidth, visible, onError]);
  return (
    <div
      className="pdf-sheet"
      ref={host}
      style={{ width: pageWidth, height: pageWidth * pageAspect }}
    />
  );
}
export function PdfPreview({
  artifact,
  onTextClick,
}: {
  artifact: string;
  onTextClick: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(650);
  const [aspect, setAspect] = useState(1.414);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setWidth(container.clientWidth));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let clean = () => {};
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        setPdf(null);
        setError("");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: `/api/pdf/${artifact}` });
        clean = () => {
          void task.destroy();
        };
        const document = await task.promise;
        if (disposed) return;
        const first = await document.getPage(1);
        if (disposed) return;
        const natural = first.getViewport({ scale: 1 });
        setAspect(natural.height / natural.width);
        setPdf(document);
      } catch (reason) {
        if (!disposed)
          setError(
            reason instanceof Error ? reason.message : "PDF rendering failed",
          );
      }
    })();
    return () => {
      disposed = true;
      clean();
    };
  }, [artifact]);
  return (
    <>
      <div className="pdf-controls">
        <span>
          {pdf
            ? `${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`
            : "Rendering PDF…"}
        </span>
        <span className="pdf-zoom">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
          >
            +
          </button>
        </span>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="pdf-pages" ref={host}>
        {pdf &&
          Array.from({ length: pdf.numPages }, (_, index) => (
            <PdfPage
              key={`${artifact}:${index}`}
              pdf={pdf}
              number={index + 1}
              width={width}
              zoom={zoom}
              aspect={aspect}
              onTextClick={onTextClick}
              onError={setError}
            />
          ))}
      </div>
      <div className="preview-note">
        Double-click selectable PDF text to find its source (approximate).
      </div>
    </>
  );
}
