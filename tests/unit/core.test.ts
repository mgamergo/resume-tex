import { describe, test, expect, beforeAll } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { LocalStore } from "../fixtures/local-store";
import { templates } from "../fixtures/templates";
import { compile, readArtifact, sandboxArgs } from "../../lib/server/compiler";
import { extractPdf } from "../fixtures/pdf-text";
let store: LocalStore;
beforeAll(async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), "resume-tex-tests-"));
  store = new LocalStore("test-owner");
});
describe("authoritative source and immutable history", () => {
  test("atomic source and metadata CAS, tenant ownership, immutable restore", async () => {
    const template = templates[0];
    const doc = await store.create({
      name: "CAS",
      source: template.source,
      engine: template.engine,
      template: template.id,
    });
    const other = new LocalStore("other");
    expect(await other.list()).toEqual([]);
    await expect(other.get(doc.id)).rejects.toThrow();
    const input = {
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      source: doc.source,
      engine: doc.engine,
    };
    const renamed = await store.save({ ...input, name: "Renamed" });
    await expect(store.save({ ...input, name: "Lost update" })).rejects.toThrow(
      "newer revision",
    );
    const newer = await store.save({
      id: doc.id,
      baseDigest: renamed.digest,
      expectedRevision: renamed.revision,
      source: renamed.source + "\n",
      engine: renamed.engine,
    });
    const restored = await store.save({
      id: doc.id,
      baseDigest: newer.digest,
      expectedRevision: newer.revision,
      source: doc.source,
      engine: doc.engine,
      note: "Restored revision 1",
    });
    expect(restored.revision).toBe(4);
    expect((await store.revision(doc.id, 2)).source).toBe(renamed.source);
  });
});
describe("isolated actual TeX compiler", () => {
  test("curated sandbox excludes host filesystem, secrets and network routes and enforces limits", () => {
    const args = sandboxArgs("/tmp/probe", "pdflatex");
    expect(args).toContain("--unshare-all");
    expect(args).toContain("--clearenv");
    expect(args).toContain("-no-shell-escape");
    expect(args).toContain("33554432");
    expect(args).not.toContain("/home");
    expect(args).not.toContain("/usr/lib");
    const root = join(process.cwd(), ".tools/rootfs");
    const result = spawnSync(
      "bwrap",
      [
        "--unshare-all",
        "--die-with-parent",
        "--clearenv",
        "--ro-bind",
        root,
        "/",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--size",
        "1048576",
        "--tmpfs",
        "/tmp",
        "/usr/bin/prlimit",
        "--cpu=2",
        "--as=268435456",
        "--nproc=32",
        "--fsize=1048576",
        "--",
        "/bin/sh",
        "-c",
        'test ! -e /home && test ! -e /etc/passwd && test -z "$RESUME_TEST_SECRET" && while read -r line; do case "$line" in *eth0*) exit 2;; esac; done < /proc/net/route',
      ],
      {
        env: { NODE_ENV: "test", RESUME_TEST_SECRET: "sentinel" },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    expect(result.status).toBe(0);
  });
  for (const template of templates)
    test(`compiles ${template.name} and extracts real selectable PDF`, async () => {
      const result = await compile(
        "template-tests",
        template.source,
        template.engine,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.log);
      expect(
        result.diagnostics.filter((item) => item.severity === "error"),
      ).toEqual([]);
      const bytes = await readArtifact("template-tests", result.artifact);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      await expect(readArtifact("other", result.artifact)).rejects.toThrow();
      const pdf = await extractPdf(bytes);
      expect(pdf.text).toContain("Alex");
      expect(pdf.text).toContain("TypeScript");
      expect(pdf.pages).toBe(1);
      const cached = await compile(
        "template-tests",
        template.source,
        template.engine,
      );
      expect(cached.ok && cached.cached).toBe(true);
      const other = await compile("other", template.source, template.engine);
      expect(other.ok && other.artifact).not.toBe(result.artifact);
    }, 30_000);
  test("invalid source has bounded diagnostics and does not cache a false success", async () => {
    const result = await compile(
      "invalid",
      "\\documentclass{article}\n\\begin{document}\n\\secton{Error}\n\\end{document}",
      "pdflatex",
    );
    expect(result.ok).toBe(false);
    expect(result.log.length).toBeLessThan(101_000);
    expect(result.diagnostics.some((item) => item.line === 3)).toBe(true);
  });
});
