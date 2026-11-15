import { sanitize } from "./diagnostics";
export { sanitize } from "./diagnostics";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { getStore } from "../../lib/server/store";
import { z } from "zod";
const backend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const identitySchema = z.object({ userId: z.string(), runId: z.string() });
type Identity = z.infer<typeof identitySchema>;
type Account = Identity &
  ({ state: "created" } | { state: "signedIn"; token: string });
const pageUsers = new WeakMap<Page, Map<string, Account>>();
const ledgerPath = ".data/refresh-test-users.json";
async function ledger() {
  try {
    return z
      .array(identitySchema)
      .parse(JSON.parse(await readFile(ledgerPath, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
}
async function record(identity: Identity) {
  await writeFile(ledgerPath, JSON.stringify([...(await ledger()), identity]));
}
async function forget(userId: string) {
  await writeFile(
    ledgerPath,
    JSON.stringify((await ledger()).filter((item) => item.userId !== userId)),
  );
}
function users(page: Page) {
  let owned = pageUsers.get(page);
  if (!owned) {
    owned = new Map();
    pageUsers.set(page, owned);
  }
  return owned;
}
export async function signIn(page: Page, existing?: Identity) {
  await setupClerkTestingToken({ page });
  const runId = existing?.runId ?? crypto.randomUUID();
  const user = existing
    ? await backend.users.getUser(existing.userId)
    : await backend.users.createUser({
        emailAddress: [`resume-e2e-${crypto.randomUUID()}@example.com`],
        skipPasswordRequirement: true,
        privateMetadata: { purpose: "resume-tex-e2e", runId },
      });
  if (
    existing &&
    (user.privateMetadata.purpose !== "resume-tex-e2e" ||
      user.privateMetadata.runId !== runId)
  )
    throw new Error("Invalid test owner");
  const identity = { userId: user.id, runId };
  users(page).set(user.id, { ...identity, state: "created" });
  await record(identity);
  await page.goto("/");
  await clerk.loaded({ page });
  expect(
    await page.evaluate(() => window.Clerk.user?.id ?? null),
    "A fresh test context must be signed out",
  ).toBeNull();
  const ticket = await backend.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 120,
  });
  await clerk.signIn({
    page,
    signInParams: { strategy: "ticket", ticket: ticket.token },
  });
  expect(await page.evaluate(() => window.Clerk.user?.id)).toBe(user.id);
  const token = await page.evaluate(async () => {
    const value = await window.Clerk.session?.getToken({ template: "convex" });
    if (!value) throw new Error("Missing authenticated Convex token");
    return value;
  });
  users(page).set(user.id, { ...identity, state: "signedIn", token });
  await expect(
    page.getByRole("button", { name: "New resume", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".loading-state")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  return user.id;
}
export async function cleanupAccount(account: Account) {
  const user = await backend.users.getUser(account.userId);
  if (
    user.privateMetadata.purpose !== "resume-tex-e2e" ||
    user.privateMetadata.runId !== account.runId
  )
    throw new Error("Refusing to delete an unmarked test identity");
  const sessions = await backend.sessions.getSessionList({
    userId: account.userId,
  });
  const active = sessions.data.find((session) => session.status === "active");
  if (active && active.userId !== account.userId)
    throw new Error("Refusing cleanup for another session identity");
  const token = active
    ? (await backend.sessions.getToken(active.id, "convex")).jwt
    : account.state === "signedIn"
      ? account.token
      : undefined;
  if (token) {
    const store = getStore(token);
    for (const resume of await store.list()) await store.remove(resume.id);
  }
  await backend.users.deleteUser(account.userId);
  await forget(account.userId);
}
export async function cleanup(page: Page) {
  const owned = users(page);
  const failures: string[] = [];
  for (const [userId, account] of owned) {
    try {
      await cleanupAccount(account);
      owned.delete(userId);
    } catch (error) {
      failures.push(
        sanitize(error instanceof Error ? error.message : "Cleanup failed"),
      );
    }
  }
  if (failures.length)
    throw new Error(`Test-owned cleanup failed: ${failures.join("; ")}`);
}
