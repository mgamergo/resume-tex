import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  cp,
  symlink,
  writeFile,
  chmod,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compile, policy } from "../../lib/server/compiler";
function trustedProbe(
  script: string,
  { cpu = 2, file = 4_194_304, size = 1_048_576 } = {},
) {
  return spawnSync(
    "bwrap",
    [
      "--unshare-all",
      "--die-with-parent",
      "--clearenv",
      "--ro-bind",
      join(process.cwd(), ".tools/rootfs"),
      "/",
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--size",
      String(size),
      "--tmpfs",
      "/tmp",
      "/usr/bin/prlimit",
      `--cpu=${cpu}`,
      `--fsize=${file}`,
      "--as=268435456",
      "--nproc=32",
      "--",
      "/bin/sh",
      "-c",
      script,
    ],
    { env: { NODE_ENV: "test" }, encoding: "utf8", timeout: 5000 },
  );
}
test("kernel sized tmpfs and per-file limits reject bounded trusted writes", () => {
  const quota = trustedProbe("/usr/bin/head -c 2097152 /dev/zero > /tmp/probe");
  expect(quota.status).not.toBe(0);
  expect(quota.stderr).toContain("No space left");
  const file = trustedProbe("/usr/bin/head -c 2097152 /dev/zero > /tmp/probe", {
    size: 4_194_304,
    file: 1_048_576,
  });
  expect(file.status).not.toBe(0);
});
test("CPU limit terminates a trusted busy loop", () => {
  const result = trustedProbe("while :; do :; done", { cpu: 1 });
  expect(result.error).toBeUndefined();
  expect(result.status === 137 || result.signal === "SIGKILL").toBe(true);
}, 7000);
test("wall deadline cleans scratch and releases the compiler queue after interruption", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "compiler-fixture-"));
  const previousTools = process.env.TEX_TOOLS_DIR;
  const previousWall = policy.wallMs;
  const before = (await readdir(tmpdir()))
    .filter((name) => name.startsWith("resume-tex-"))
    .sort();
  try {
    await cp(".tools/rootfs", join(fixture, "rootfs"), { recursive: true });
    await symlink(
      join(process.cwd(), ".tools/.TinyTeX"),
      join(fixture, ".TinyTeX"),
    );
    await chmod(join(fixture, "rootfs/usr/bin/compiler-runner"), 0o755);
    await writeFile(
      join(fixture, "rootfs/usr/bin/compiler-runner"),
      "#!/bin/sh\nwhile :; do :; done\n",
    );
    await writeFile(
      join(fixture, "toolchain.sha256"),
      "trusted-timeout-fixture",
    );
    process.env.TEX_TOOLS_DIR = fixture;
    policy.wallMs = 200;
    const stopped = await compile(
      "deadline-fixture",
      "trusted runner ignores document",
      "pdflatex",
    );
    expect(stopped.ok).toBe(false);
    expect(stopped.log).toContain("Compilation stopped");
  } finally {
    if (previousTools) process.env.TEX_TOOLS_DIR = previousTools;
    else delete process.env.TEX_TOOLS_DIR;
    policy.wallMs = previousWall;
    await rm(fixture, { recursive: true, force: true });
  }
  expect(
    (await readdir(tmpdir()))
      .filter((name) => name.startsWith("resume-tex-"))
      .sort(),
  ).toEqual(before);
  const next = await compile(
    "after-timeout",
    "\\documentclass{article}\\begin{document}Queue recovered.\\end{document}",
    "pdflatex",
  );
  expect(next.ok).toBe(true);
}, 15_000);
