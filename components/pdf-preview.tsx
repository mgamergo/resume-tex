"use client";
import { useEffect, useRef, useState } from "react";
export function PdfPreview({
  artifact,
  onTextClick,
}: {
  artifact: string;
  onTextClick: (text: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const click = useRef(onTextClick);
  useEffect(() => {
    click.current = onTextClick;
  }, [onTextClick]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let clean: () => void = () => {};
    let observer: ResizeObserver | undefined;
    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: `/api/pdf/${artifact}` });
        clean = () => {
          void task.destroy();
        };
        const pdf = await task.promise;
        if (disposed) {
          await task.destroy();
          return;
        }
        setPages(pdf.numPages);
        setError("");
        let rendering = false;
        let pending = false;
        const draw = async () => {
          if (disposed) return;
          if (rendering) {
            pending = true;
            return;
          }
          rendering = true;
          try {
            container.replaceChildren();
            for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
              if (disposed) break;
              const page = await pdf.getPage(pageNo);
              const natural = page.getViewport({ scale: 1 });
              const width = Math.min(container.clientWidth - 32, 850) * zoom;
              const viewport = page.getViewport({
                scale: Math.max(0.25, width / natural.width),
              });
              const ratio = window.devicePixelRatio || 1;
              const sheet = document.createElement("div");
              sheet.className = "pdf-sheet";
              sheet.style.width = `${viewport.width}px`;
              sheet.style.height = `${viewport.height}px`;
              sheet.style.setProperty("--scale-factor", String(viewport.scale));
              sheet.style.setProperty(
                "--total-scale-factor",
                String(viewport.scale),
              );
              const canvas = document.createElement("canvas");
              canvas.setAttribute("aria-label", `PDF page ${pageNo}`);
              canvas.width = Math.ceil(viewport.width * ratio);
              canvas.height = Math.ceil(viewport.height * ratio);
              canvas.style.width = `${viewport.width}px`;
              canvas.style.height = `${viewport.height}px`;
              const context = canvas.getContext("2d");
              if (!context) throw new Error("Canvas is unavailable");
              sheet.appendChild(canvas);
              const layer = document.createElement("div");
              layer.className = "textLayer";
              layer.setAttribute(
                "aria-label",
                `Selectable text page ${pageNo}`,
              );
              layer.addEventListener("dblclick", (event) => {
                if (event.target instanceof HTMLElement)
                  click.current(event.target.textContent ?? "");
              });
              sheet.appendChild(layer);
              container.appendChild(sheet);
              await page.render({
                canvasContext: context,
                canvas,
                viewport,
                transform: [ratio, 0, 0, ratio, 0, 0],
              }).promise;
              const text = new pdfjs.TextLayer({
                textContentSource: await page.getTextContent(),
                container: layer,
                viewport,
              });
              await text.render();
            }
          } catch (reason) {
            if (!disposed)
              setError(
                reason instanceof Error
                  ? reason.message
                  : "PDF rendering failed",
              );
          } finally {
            rendering = false;
            if (pending) {
              pending = false;
              void draw();
            }
          }
        };
        await draw();
        if (disposed) return;
        observer = new ResizeObserver(() => {
          void draw();
        });
        observer.observe(container);
      } catch (reason) {
        if (!disposed)
          setError(
            reason instanceof Error ? reason.message : "PDF rendering failed",
          );
      }
    };
    void render();
    return () => {
      disposed = true;
      observer?.disconnect();
      clean();
      container.replaceChildren();
    };
  }, [artifact, zoom]);
  return (
    <>
      <div className="pdf-controls">
        <span>
          {pages
            ? `${pages} ${pages === 1 ? "page" : "pages"}`
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
      <div className="pdf-pages" ref={host} />
      <div className="preview-note">
        Double-click selectable PDF text to find its source (approximate).
      </div>
    </>
  );
}
