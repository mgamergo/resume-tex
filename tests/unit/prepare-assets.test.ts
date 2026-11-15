import { test, expect } from "bun:test";
import { mkdtempSync, symlinkSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
test("fresh asset preparation creates its generated directories", () => {
  const cwd = mkdtempSync(join(tmpdir(), "resume-assets-"));
  try {
    symlinkSync(resolve("node_modules"), join(cwd, "node_modules"), "dir");
    symlinkSync(resolve("scripts"), join(cwd, "scripts"), "dir");
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/prepare-assets.ts")],
      {
        cwd,
        encoding: "utf8",
        timeout: 15000,
        env: { PATH: process.env.PATH, NODE_ENV: "test" },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(cwd, "public/pdf.worker.min.mjs"))).toBe(true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
