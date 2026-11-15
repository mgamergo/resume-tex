import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DomainError } from "../../lib/core/model";
import { z } from "zod";
export const pdfExtractionPolicy = {
  wallMs: 8_000,
  memoryBytes: 4_294_967_296,
  maxInputBytes: 10_485_760,
  maxOutputBytes: 4_000_000,
  maxQueue: 3,
};
let waiting = 0;
let tail: Promise<void> = Promise.resolve();
export async function extractPdf(
  bytes: Uint8Array,
): Promise<{ text: string; pages: number }> {
  if (bytes.byteLength > pdfExtractionPolicy.maxInputBytes)
    throw new DomainError("PDF exceeds analysis input limit", 422);
  if (waiting >= pdfExtractionPolicy.maxQueue)
    throw new DomainError("PDF analyzer is busy. Try again shortly.", 429);
  waiting++;
  const previous = tail;
  let release: () => void = () => {};
  tail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  let scratch: string | undefined;
  try {
    scratch = await mkdtemp(join(tmpdir(), "resume-pdf-"));
    const input = join(scratch, "input.pdf");
    const output = join(scratch, "output.json");
    const errors = join(scratch, "errors.log");
    await writeFile(input, bytes, { mode: 0o600 });
    const descriptors = [
      openSync(input, "r"),
      openSync(output, "w", 0o600),
      openSync(errors, "w", 0o600),
    ];
    const result = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      stopped: boolean;
    }>((resolve, reject) => {
      const child = spawn(
        "/usr/bin/prlimit",
        [
          `--as=${pdfExtractionPolicy.memoryBytes}`,
          "--cpu=6",
          "--core=0",
          "--nofile=64",
          "--fsize=4194304",
          "--",
          process.env.PDF_NODE_BINARY || "/usr/bin/node",
          "--disable-wasm-trap-handler",
          "--max-old-space-size=128",
          "--max-semi-space-size=8",
          join(process.cwd(), ".tools/pdf-worker.mjs"),
        ],
        {
          env: {
            NODE_ENV: "production",
            UV_THREADPOOL_SIZE: "2",
            RAYON_NUM_THREADS: "2",
          },
          stdio: descriptors,
          detached: true,
        },
      );
      for (const descriptor of descriptors) closeSync(descriptor);
      let stopped = false;
      const timer = setTimeout(() => {
        stopped = true;
        if (child.pid)
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
      }, pdfExtractionPolicy.wallMs);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stopped });
      });
    });
    if (result.stopped || result.code !== 0) {
      const reason = (await readFile(errors, "utf8").catch(() => ""))
        .slice(0, 1024)
        .replace(/[\u0000-\u001f\u007f]/g, " ");
      console.error(
        JSON.stringify({
          event: "pdf_worker_failed",
          code: result.code,
          signal: result.signal,
          deadline: result.stopped,
          reason,
        }),
      );
    }
    if (result.stopped || result.code !== 0)
      throw new DomainError(
        result.stopped
          ? "PDF analysis stopped at its time or output limit."
          : "PDF analysis could not read this document. Review server diagnostics.",
        422,
      );
    if ((await stat(output)).size > pdfExtractionPolicy.maxOutputBytes)
      throw new DomainError("PDF analysis output limit exceeded", 422);
    try {
      return z
        .object({ text: z.string(), pages: z.number() })
        .parse(JSON.parse(await readFile(output, "utf8")));
    } catch {
      throw new DomainError("PDF analyzer returned invalid output", 422);
    }
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    waiting--;
    release();
  }
}
