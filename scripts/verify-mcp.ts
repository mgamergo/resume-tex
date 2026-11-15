import { createClerkClient } from "@clerk/backend";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, open } from "node:fs/promises";
import { parseEnv } from "node:util";
import { existsSync } from "node:fs";
// This verifier may only configure its fresh, anonymous loopback Convex backend.
const local = parseEnv(await readFile(".env.local", "utf8"));
if (
  !local.CONVEX_DEPLOYMENT?.startsWith("anonymous:") ||
  !["127.0.0.1", "localhost"].includes(
    new URL(local.NEXT_PUBLIC_CONVEX_URL ?? "").hostname,
  )
)
  throw new Error(
    "Verification requires a fresh anonymous local Convex deployment",
  );
delete process.env.CONVEX_DEPLOY_KEY;
Object.assign(process.env, local);
for (const name of ["AI_API_KEY", "AI_MODEL", "AI_BASE_URL"])
  delete process.env[name];
process.env.CONVEX_AGENT_MODE = "anonymous";
process.env.APP_ORIGIN = "http://localhost:3100";
process.env.INSTABOX_HEADLESS = "1";
if (
  !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH &&
  existsSync("/usr/bin/chromium")
)
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/usr/bin/chromium";
await mkdir("artifacts", { recursive: true });
await mkdir(".data", { recursive: true });
async function command(args: string[], name: string) {
  const file = await open(`artifacts/${name}.log`, "w");
  try {
    const child = spawn(args[0], args.slice(1), {
      env: process.env,
      stdio: ["ignore", file.fd, file.fd],
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", resolve);
    });
    if (code !== 0)
      throw new Error(`${name} failed (${code}), see artifacts/${name}.log`);
    console.error(`${name} passed`);
  } finally {
    await file.close();
  }
}
const backend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const runId = crypto.randomUUID();
const user = await backend.users.createUser({
  emailAddress: [`resume-e2e-${crypto.randomUUID()}@example.com`],
  skipPasswordRequirement: true,
  privateMetadata: { purpose: "resume-tex-e2e", runId },
});
process.env.MCP_OWNER_CLERK_ID = user.id;
await writeFile(
  ".data/mcp-test-owner.json",
  JSON.stringify({ userId: user.id, runId }),
  { mode: 0o600 },
);
let convex: ReturnType<typeof spawn> | undefined;
let convexLog: Awaited<ReturnType<typeof open>> | undefined;
try {
  if (!process.env.CLERK_JWT_ISSUER_DOMAIN) throw Error("Missing Clerk issuer");
  await command(
    [
      "bunx",
      "convex",
      "env",
      "set",
      "CLERK_JWT_ISSUER_DOMAIN",
      process.env.CLERK_JWT_ISSUER_DOMAIN,
    ],
    "local-clerk-issuer",
  );
  await command(
    ["bunx", "convex", "env", "set", "MCP_OWNER_CLERK_ID", user.id],
    "local-mcp-owner",
  );
  convexLog = await open("artifacts/local-convex.log", "w");
  convex = spawn("bunx", ["convex", "dev", "--tail-logs", "disable"], {
    env: process.env,
    stdio: ["ignore", convexLog.fd, convexLog.fd],
    detached: true,
  });
  const deadline = Date.now() + 90000;
  while (
    !(await readFile("artifacts/local-convex.log", "utf8")).includes(
      "Convex functions ready",
    )
  ) {
    if (convex.exitCode !== null || Date.now() > deadline)
      throw Error("Local Convex did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  for (const name of ["format:check", "typecheck", "lint", "test", "build"])
    await command(["bun", "run", name], name.replace(":", "-"));
  await command(["bun", "run", "test:e2e"], "e2e");
} finally {
  if (convex?.pid) {
    try {
      process.kill(-convex.pid, "SIGTERM");
    } catch {}
    await new Promise((resolve) => {
      if (convex?.exitCode !== null) resolve(null);
      else convex?.once("exit", resolve);
    });
  }
  await convexLog?.close();
  try {
    const current = await backend.users.getUser(user.id);
    if (
      current.privateMetadata.purpose !== "resume-tex-e2e" ||
      current.privateMetadata.runId !== runId
    )
      throw Error("Test cleanup identity mismatch");
    await backend.users.deleteUser(user.id);
  } catch (error) {
    if (!(
      typeof error === "object" &&
      error &&
      "status" in error &&
      error.status === 404
    ))
      throw error;
  }
}
