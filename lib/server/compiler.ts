import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  stat,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { digest } from "../core/digest";
import { DomainError, type Engine } from "../core/model";
export const policy = {
  version: "tex-isolation-1",
  wallMs: 20_000,
  cpuSeconds: 12,
  memoryBytes: 805_306_368,
  fileBytes: 12_582_912,
  logBytes: 100_000,
  maxPdfBytes: 10_485_760,
  maxQueue: 6,
  maxCacheBytes: 200_000_000,
};
export type Diagnostic = {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
};
export type CompileResult =
  | {
      ok: true;
      artifact: string;
      digest: string;
      log: string;
      diagnostics: Diagnostic[];
      cached: boolean;
    }
  | {
      ok: false;
      digest: string;
      log: string;
      diagnostics: Diagnostic[];
      error: string;
    };
let waiting = 0;
let tail: Promise<void> = Promise.resolve();
const root = () =>
  resolve(/*turbopackIgnore: true*/ process.env.TEX_TOOLS_DIR ?? ".tools");
const cache = () =>
  resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? ".data", "pdf");
export function sandboxArgs(scratch: string, engine: Engine) {
  return [
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--clearenv",
    "--ro-bind",
    join(root(), "rootfs"),
    "/",
    "--ro-bind",
    join(root(), ".TinyTeX"),
    "/tex",
    "--size",
    "33554432",
    "--tmpfs",
    "/work",
    "--ro-bind",
    join(scratch, "main.tex"),
    "/input/main.tex",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--size",
    "16777216",
    "--tmpfs",
    "/tmp",
    "--setenv",
    "HOME",
    "/tmp",
    "--setenv",
    "PATH",
    "/tex/bin/x86_64-linux",
    "--setenv",
    "TEXMFHOME",
    "/tmp/texmf",
    "--setenv",
    "TEXMFVAR",
    "/tmp/texmf-var",
    "--setenv",
    "TEXMFCONFIG",
    "/tmp/texmf-config",
    "--setenv",
    "TEXMFCACHE",
    "/tmp/texmf-cache",
    "--setenv",
    "openin_any",
    "p",
    "--setenv",
    "openout_any",
    "p",
    "--setenv",
    "shell_escape",
    "0",
    "--setenv",
    "FONTCONFIG_FILE",
    "/etc/fonts.conf",
    "--chdir",
    "/work",
    "/usr/bin/prlimit",
    `--cpu=${policy.cpuSeconds}`,
    `--as=${policy.memoryBytes}`,
    "--nproc=32",
    `--fsize=${policy.fileBytes}`,
    "--nofile=64",
    "--",
    "/bin/sh",
    "/usr/bin/compiler-runner",
    `/tex/bin/x86_64-linux/${engine}`,
    "-no-shell-escape",
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-file-line-error",
    "-synctex=0",
    "-jobname=resume",
    "/input/main.tex",
  ];
}
export function parseDiagnostics(log: string): Diagnostic[] {
  const result: Diagnostic[] = [];
  for (const line of log.split("\n")) {
    const match = line.match(/(?:\.\/)?main\.tex:(\d+):\s*(.+)/);
    if (match)
      result.push({
        line: Number(match[1]),
        column: 1,
        message: match[2],
        severity: "error",
      });
    else if (/(?:LaTeX|Package).*Warning:/.test(line))
      result.push({
        line: 1,
        column: 1,
        message: line.trim(),
        severity: "warning",
      });
  }
  if (!result.length && log.includes("!"))
    result.push({
      line: 1,
      column: 1,
      message:
        log.split("\n").find((line) => line.startsWith("!")) ??
        "Compilation failed",
      severity: "error",
    });
  return result.slice(0, 30);
}
async function runSandbox(
  scratch: string,
  engine: Engine,
): Promise<{ code: number; log: string; pdf: Buffer }> {
  return new Promise((resolveRun, reject) => {
    const child = spawn("bwrap", sandboxArgs(scratch, engine), {
      env: { NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let log = "";
    let output = "";
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (child.pid)
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
    };
    const timeout = setTimeout(stop, policy.wallMs);
    child.stderr.on("data", (chunk: Buffer) => {
      log += chunk.toString();
      if (Buffer.byteLength(log) > policy.logBytes) {
        log = log.slice(0, policy.logBytes) + "\nLog limit reached.";
        stop();
      }
    });
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > Math.ceil(policy.maxPdfBytes * 1.4)) stop();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolveRun({
        code: stopped ? 124 : (code ?? 1),
        log: stopped
          ? log + "\nCompilation stopped at resource or time limit."
          : log,
        pdf: Buffer.from(output, "base64"),
      });
    });
  });
}
async function pruneCache() {
  const files = await readdir(cache());
  const entries = await Promise.all(
    files.map(async (name) => ({
      name,
      info: await stat(join(cache(), name)),
    })),
  );
  let total = entries.reduce((sum, item) => sum + item.info.size, 0);
  for (const entry of entries.sort((a, b) => a.info.mtimeMs - b.info.mtimeMs)) {
    if (total <= policy.maxCacheBytes) break;
    await rm(join(cache(), entry.name), { force: true });
    total -= entry.info.size;
  }
}
export async function compile(
  owner: string,
  source: string,
  engine: Engine,
): Promise<CompileResult> {
  if (waiting >= policy.maxQueue)
    throw new DomainError("Compiler is busy. Try again shortly.", 429);
  waiting++;
  const previous = tail;
  let release: () => void = () => {};
  tail = new Promise((resolveTail) => {
    release = resolveTail;
  });
  await previous;
  let scratch: string | undefined;
  try {
    const sourceDigest = digest(source);
    let toolchain: string;
    try {
      toolchain = await readFile(join(root(), "toolchain.sha256"), "utf8");
      await stat(join(root(), "rootfs/usr/bin/prlimit"));
    } catch {
      throw new DomainError(
        "Compiler runtime missing. Run bun run setup:tex. Compilation requires a working Bubblewrap sandbox.",
        503,
      );
    }
    const artifact = digest(
      [owner, source, engine, toolchain, JSON.stringify(policy)].join("\0"),
    );
    await mkdir(cache(), { recursive: true, mode: 0o700 });
    try {
      await readArtifact(owner, artifact);
      const log = await readFile(join(cache(), artifact + ".log"), "utf8");
      return {
        ok: true,
        artifact,
        digest: sourceDigest,
        log,
        diagnostics: parseDiagnostics(log),
        cached: true,
      };
    } catch {}
    scratch = await mkdtemp(join(tmpdir(), "resume-tex-"));
    await writeFile(join(scratch, "main.tex"), source, { mode: 0o600 });
    const result = await runSandbox(scratch, engine);
    const log = result.log;
    if (result.code !== 0)
      return {
        ok: false,
        digest: sourceDigest,
        log,
        diagnostics: parseDiagnostics(log),
        error:
          result.code === 124
            ? "Compiler resource limit reached"
            : "Compilation failed. Review the diagnostics below.",
      };
    const pdf = result.pdf;
    if (
      pdf.length > policy.maxPdfBytes ||
      pdf.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new DomainError("Compiler produced an invalid or oversized PDF");
    await writeFile(join(cache(), artifact + ".pdf"), pdf, { mode: 0o600 });
    await writeFile(join(cache(), artifact + ".log"), log, { mode: 0o600 });
    await writeFile(
      join(cache(), artifact + ".json"),
      JSON.stringify({ owner, sourceDigest }),
      { mode: 0o600 },
    );
    await pruneCache();
    return {
      ok: true,
      artifact,
      digest: sourceDigest,
      log,
      diagnostics: parseDiagnostics(log),
      cached: false,
    };
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    waiting--;
    release();
  }
}
export async function readArtifact(owner: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new DomainError("Invalid artifact", 400);
  try {
    const metadata: unknown = JSON.parse(
      await readFile(join(cache(), id + ".json"), "utf8"),
    );
    if (
      !metadata ||
      typeof metadata !== "object" ||
      !("owner" in metadata) ||
      metadata.owner !== owner
    )
      throw new Error("Owner mismatch");
    return await readFile(join(cache(), id + ".pdf"));
  } catch {
    throw new DomainError("PDF not found. Compile the resume again.", 404);
  }
}
