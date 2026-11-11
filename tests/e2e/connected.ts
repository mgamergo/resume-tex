import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
import { resumeSummarySchema } from "../../lib/core/schemas";
import { z } from "zod";
const backend = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const ownedUsers = new Map<string, Set<string>>();
export function sanitize(value: string) {
  return value
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
      } catch {
        return "[url]";
      }
    })
    .replace(/eyJ[a-zA-Z0-9_.-]+/g, "[redacted]");
}
export async function signIn(page: Page) {
  await setupClerkTestingToken({ page });
  const user = await backend.users.createUser({
    emailAddress: [`resume-e2e-${crypto.randomUUID()}@example.com`],
    skipPasswordRequirement: true,
    privateMetadata: { purpose: "resume-tex-e2e", runId: crypto.randomUUID() },
  });
  ownedUsers.set(user.id, new Set());
  await page.goto("/");
  await clerk.loaded({ page });
  const ticket = await backend.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 120,
  });
  await clerk.signIn({
    page,
    signInParams: { strategy: "ticket", ticket: ticket.token },
  });
  await expect(
    page.getByRole("button", { name: "New resume", exact: true }),
  ).toBeVisible();
  return user.id;
}
export async function cleanup(page: Page) {
  for (const [userId, ids] of ownedUsers) {
    const active = await page
      .evaluate(() => window.Clerk?.user?.id)
      .catch(() => undefined);
    if (active === userId) {
      const response = await page.request.get("/api/workspace");
      if (response.ok()) {
        const result = z
          .object({ resumes: z.array(resumeSummarySchema) })
          .parse(await response.json());
        for (const resume of result.resumes) ids.add(resume.id);
      }
      for (const id of ids) {
        const response = await page.request.post("/api/workspace", {
          data: { op: "delete", id },
        });
        if (!response.ok() && response.status() !== 404)
          throw new Error(`Test resume cleanup HTTP ${response.status()}`);
      }
    } else if (ids.size)
      throw new Error(
        "Test account is no longer active; documents need cleanup",
      );
    const user = await backend.users.getUser(userId);
    if (user.privateMetadata.purpose !== "resume-tex-e2e")
      throw new Error("Refusing to delete an unmarked user");
    await backend.users.deleteUser(userId);
    ownedUsers.delete(userId);
  }
}
export function recordResume(userId: string, id: string) {
  ownedUsers.get(userId)?.add(id);
}
