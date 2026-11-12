import {
  test,
  expect,
  type Page,
  type Request as BrowserRequest,
} from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { signIn, cleanup, sanitize } from "./connected";
import { isNavigationCancellation } from "./diagnostics";
import { templates } from "../fixtures/templates";
import { resumeSchema } from "../../lib/core/schemas";
import {
  agentEditPolicySchema,
  submissionResultSchema,
} from "../../lib/core/agent-policy";

test.use({ video: "on" });
type BrowserReport = {
  errors: string[];
  cancellations: string[];
  inflight: Set<BrowserRequest>;
  leaving: Set<BrowserRequest> | null;
};
const reports = new WeakMap<Page, BrowserReport>();
test.beforeEach(async ({ page }) => {
  const report: BrowserReport = {
    errors: [],
    cancellations: [],
    inflight: new Set(),
    leaving: null,
  };
  reports.set(page, report);
  const clerkHost = new URL(
    process.env.CLERK_FAPI?.includes("://")
      ? process.env.CLERK_FAPI
      : "https://" + process.env.CLERK_FAPI,
  ).hostname;
  page.on("console", (message) => {
    if (message.type() === "error")
      report.errors.push(sanitize("console: " + message.text()));
  });
  page.on("pageerror", (error) =>
    report.errors.push(sanitize(error.name + ": " + error.message)),
  );
  page.on("request", (request) => report.inflight.add(request));
  page.on("requestfinished", (request) => report.inflight.delete(request));
  page.on("requestfailed", (request) => {
    const message = sanitize(
      `${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    );
    if (
      isNavigationCancellation({
        recordedBeforeNavigation: report.leaving?.has(request) ?? false,
        method: request.method(),
        resourceType: request.resourceType(),
        url: request.url(),
        failure: request.failure()?.errorText,
        appOrigin: "http://localhost:3100",
        clerkHost,
      })
    )
      report.cancellations.push(message);
    else report.errors.push(message);
    report.inflight.delete(request);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.errors.push(
        sanitize(`http ${response.status()} ${response.url()}`),
      );
  });
  await mkdir("artifacts/autonomy", { recursive: true });
  await signIn(page);
});
test.afterEach(async ({ page }, info) => {
  try {
    // Stop document polling before deleting this test's identity.
    const report = reports.get(page);
    if (report) report.leaving = new Set(report.inflight);
    await page.waitForLoadState("networkidle");
    await page.goto("about:blank");
    await cleanup(page);
    expect(report?.errors ?? []).toEqual([]);
  } finally {
    const report = reports.get(page);
    await writeFile(
      `artifacts/autonomy/diagnostics-${info.title.slice(0, 30).replace(/[^a-z0-9]/gi, "-")}.json`,
      JSON.stringify(
        {
          errors: report?.errors ?? [],
          navigationCancellations: report?.cancellations ?? [],
        },
        null,
        2,
      ),
    );
  }
});
async function createResume(page: Page) {
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/workspace" &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.op === "create",
  );
  await page.getByRole("button", { name: "New resume", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Jake's Resume/ })
    .click();
  const doc = resumeSchema.parse((await (await created).json()).resume);
  await expect(page.locator(".textLayer")).toContainText("Experience");
  const editor = page.getByRole("textbox", {
    name: "LaTeX source",
    exact: true,
  });
  await expect(editor).toBeEditable();
  await editor.fill(templates[0].source);
  await editor.press("Control+s");
  await expect(page.locator(".textLayer")).toContainText("Alex");
  await expect(page.locator(".save-status")).toContainText("All changes saved");
  return { id: doc.id, editor };
}
async function showAgent(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 768)
    await page.getByRole("tab", { name: "Assistant", exact: true }).click();
  else {
    const show = page.getByLabel("Show assistant", { exact: true });
    if (await show.isVisible()) await show.click();
  }
}
async function assertDiagnostics(page: Page) {
  expect(reports.get(page)?.errors).toEqual([]);
}
function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test("agent autonomy persists and applies real model edits with history and undo", async ({
  page,
}) => {
  const { editor } = await createResume(page);
  await showAgent(page);
  const setting = page.getByLabel("Agent edits", { exact: true });
  await expect(setting).toHaveValue("review");
  await setting.selectOption("autonomous");
  await expect(setting).toHaveValue("autonomous");
  await expect(setting).toBeEnabled();
  await page
    .getByLabel("Ask for a targeted change")
    .fill(
      'Replace only the first bullet sentence "Built a TypeScript dashboard used by 120 teammates to review service health." with "Built a service-health dashboard in TypeScript for 120 teammates." Use rewrite_bullet or an exact range_patch and preserve every other character.',
    );
  const edited = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/agent" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const response = await edited;
  expect(response.status()).toBe(200);
  const result = submissionResultSchema.parse(await response.json());
  expect(result.kind).toBe("applied");
  await expect(editor).toContainText("service-health dashboard");
  await expect(page.locator(".textLayer")).toContainText("service-health");
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo proposal", exact: true })
    .click();
  await expect(editor).toContainText("Built a TypeScript dashboard");
  await expect(setting).toHaveValue("autonomous");
  const held = deferred();
  const release = deferred();
  await page.route("**/api/agent", async (route) => {
    held.release();
    await release.promise;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Put skills first", exact: true })
      .click();
    await held.promise;
    await expect(setting).toBeEnabled();
    await setting.selectOption("review");
    await expect(setting).toHaveValue("review");
    await expect(setting).toBeEnabled();
    release.release();
    await expect(page.locator(".proposal-card")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reject", exact: true }).click();
  } finally {
    release.release();
    await page.unroute("**/api/agent");
  }
  await setting.selectOption("autonomous");
  await expect(setting).toHaveValue("autonomous");
  await expect(setting).toBeEnabled();
  await page.waitForLoadState("networkidle");
  const report = reports.get(page);
  if (report) report.leaving = new Set(report.inflight);
  await page.reload();
  await page
    .locator(".resume-card")
    .filter({ hasText: "Jake's Resume resume" })
    .click();
  await showAgent(page);
  await expect(page.getByLabel("Agent edits", { exact: true })).toHaveValue(
    "autonomous",
  );
  if (report) report.leaving = null;
  await expect(page.locator(".textLayer")).toContainText("Alex Morgan");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await showAgent(page);
    for (const theme of ["light", "dark"]) {
      await page
        .locator('select[aria-label="Theme"]:visible')
        .selectOption(theme);
      const control = page.getByLabel("Agent edits", { exact: true });
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      if (!bounds) throw new Error("Missing permission control bounds");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      if (viewport.width > 768)
        await expect(page.locator(".textLayer")).toContainText("Alex Morgan");
      await page.screenshot({
        path: `artifacts/autonomy/${viewport.width}-${theme}-permission.png`,
        animations: "disabled",
      });
    }
  }
  await assertDiagnostics(page);
});

test("external MCP follows review and autonomy and syncs source PDF and history", async ({
  page,
}) => {
  const { id, editor } = await createResume(page);
  await showAgent(page);
  const token = await page.evaluate(async () => {
    const jwt = await window.Clerk.session?.getToken({
      template: "convex",
      skipCache: true,
    });
    if (!jwt) throw new Error("Missing test-owned Convex JWT");
    return jwt;
  });
  const env = z
    .object({
      PATH: z.string(),
      CLERK_SECRET_KEY: z.string(),
      NEXT_PUBLIC_CONVEX_URL: z.string(),
    })
    .parse(process.env);
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["scripts/mcp.ts"],
    cwd: process.cwd(),
    env: { ...env, MCP_RESUME_ID: id, MCP_CLERK_TOKEN: token },
    stderr: "pipe",
  });
  const client = new Client({ name: "resume-autonomy-e2e", version: "1.0.0" });
  const stderr: string[] = [];
  transport.stderr?.on("data", (chunk) => stderr.push(sanitize(String(chunk))));
  const decode = (value: unknown): unknown => {
    const response = z
      .object({
        content: z
          .array(z.object({ type: z.literal("text"), text: z.string() }))
          .min(1),
        isError: z.boolean().optional(),
      })
      .parse(value);
    if (response.isError) throw new Error(sanitize(response.content[0].text));
    return JSON.parse(response.content[0].text);
  };
  const document = z.object({
    kind: z.literal("document"),
    resume: resumeSchema,
    policy: agentEditPolicySchema,
  });
  try {
    await client.connect(transport);
    expect(
      (await client.listTools()).tools.map((tool) => tool.name).sort(),
    ).toEqual(["propose_edit", "read_document"]);
    const initial = document.parse(
      decode(await client.callTool({ name: "read_document", arguments: {} })),
    );
    expect(initial.policy.mode).toBe("review");
    const before =
      "Maintained React components and added automated tests for critical workflows.";
    const after =
      "Built React components and added automated tests for critical workflows.";
    const callFor = (source: string) => {
      const start = source.indexOf(before);
      expect(start).toBeGreaterThanOrEqual(0);
      return {
        tool: "rewrite_bullet",
        start,
        end: start + before.length,
        replacement: after,
      };
    };
    const pending = submissionResultSchema.parse(
      decode(
        await client.callTool({
          name: "propose_edit",
          arguments: {
            baseDigest: initial.resume.digest,
            call: callFor(initial.resume.source),
          },
        }),
      ),
    );
    expect(pending.kind).toBe("proposal");
    await expect(page.locator(".proposal-card")).toBeVisible({
      timeout: 30_000,
    });
    await expect(editor).toContainText(before);
    const setting = page.getByLabel("Agent edits", { exact: true });
    await setting.selectOption("autonomous");
    await expect(setting).toHaveValue("autonomous");
    await expect(setting).toBeEnabled();
    await expect(page.locator(".proposal-card")).toBeVisible();
    await expect(editor).toContainText(before);
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    const fresh = document.parse(
      decode(await client.callTool({ name: "read_document", arguments: {} })),
    );
    const applied = submissionResultSchema.parse(
      decode(
        await client.callTool({
          name: "propose_edit",
          arguments: {
            baseDigest: fresh.resume.digest,
            call: callFor(fresh.resume.source),
          },
        }),
      ),
    );
    expect(applied.kind).toBe("applied");
    await expect(editor).toContainText(after, { timeout: 30_000 });
    await expect(page.locator(".textLayer")).toContainText(
      "Built React components",
      { timeout: 30_000 },
    );
    await expect(
      page.getByRole("button", { name: "Undo proposal", exact: true }),
    ).toBeVisible();
    expect(stderr).toEqual([]);
    await assertDiagnostics(page);
  } finally {
    await client.close();
    await transport.close();
  }
});

test("automatic apply preserves typing and pauses stale autosave until explicit reload", async ({
  page,
}) => {
  const { id, editor } = await createResume(page);
  await showAgent(page);
  const setting = page.getByLabel("Agent edits", { exact: true });
  await setting.selectOption("autonomous");
  await expect(setting).toHaveValue("autonomous");
  await expect(setting).toBeEnabled();
  const committed = deferred();
  const release = deferred();
  await page.route("**/api/agent", async (route) => {
    const response = await route.fetch();
    expect(submissionResultSchema.parse(await response.json()).kind).toBe(
      "applied",
    );
    committed.release();
    await release.promise;
    await route.fulfill({ response });
  });
  const saves: string[] = [];
  const record = (request: BrowserRequest) => {
    if (
      new URL(request.url()).pathname === "/api/workspace" &&
      request.method() === "POST" &&
      request.postDataJSON()?.op === "save"
    )
      saves.push(request.postData() ?? "");
  };
  try {
    await page
      .getByRole("button", { name: "Put skills first", exact: true })
      .click();
    await committed.promise;
    const local = templates[0].source.replace("Alex Morgan", "Local Draft");
    page.on("request", record);
    await editor.fill(local);
    release.release();
    await expect(page.locator(".draft-conflict")).toBeVisible();
    await expect(editor).toContainText("Local Draft");
    await page.waitForTimeout(1600);
    expect(saves).toEqual([]);
    const persisted = await page.request.get(
      `/api/workspace?id=${encodeURIComponent(id)}`,
    );
    expect(persisted.status()).toBe(200);
    const saved = resumeSchema.parse((await persisted.json()).resume);
    expect(saved.source).not.toContain("Local Draft");
    expect(saved.source.indexOf("\\section{Skills}")).toBeLessThan(
      saved.source.indexOf("\\section{Experience}"),
    );
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft", exact: true })
      .click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe("resume.tex");
    const downloadPath = await downloaded.path();
    if (!downloadPath) throw new Error("Draft download missing");
    expect(await readFile(downloadPath, "utf8")).toBe(local);
    await page.screenshot({
      path: "artifacts/autonomy/dirty-draft-preserved.png",
    });
    await page
      .getByRole("button", {
        name: "Discard draft and load saved",
        exact: true,
      })
      .click();
    await expect(editor).toContainText("Alex Morgan");
    await expect(editor).not.toContainText("Local Draft");
    await expect(page.locator(".draft-conflict")).toHaveCount(0);
    await expect(setting).toHaveValue("autonomous");
    await expect(
      page.getByRole("button", { name: "Compile", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(async () => {
        const text = await page.locator(".textLayer").innerText();
        return (
          text.indexOf("Skills") >= 0 &&
          text.indexOf("Skills") < text.indexOf("Experience")
        );
      })
      .toBe(true);
    await assertDiagnostics(page);
  } finally {
    release.release();
    page.off("request", record);
    await page.unroute("**/api/agent");
  }
});

test("returning to resumes preserves typing entered during an awaited save", async ({
  page,
}) => {
  const { id, editor } = await createResume(page);
  const held = deferred();
  const release = deferred();
  let first = true;
  await page.route("**/api/workspace", async (route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON()?.op !== "save" ||
      !first
    ) {
      await route.continue();
      return;
    }
    first = false;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    held.release();
    await release.promise;
    await route.fulfill({ response });
  });
  try {
    await editor.fill(templates[0].source.replace("Alex Morgan", "First Save"));
    await page.getByLabel("Back to resumes", { exact: true }).click();
    await held.promise;
    await editor.fill(
      templates[0].source.replace("Alex Morgan", "Retained Draft"),
    );
    release.release();
    await expect(editor).toContainText("Retained Draft");
    await expect(page.locator(".textLayer")).toContainText("Retained Draft");
    await expect(page.locator(".save-status")).toContainText(
      "All changes saved",
    );
    const response = await page.request.get(
      `/api/workspace?id=${encodeURIComponent(id)}`,
    );
    expect(response.status()).toBe(200);
    expect(resumeSchema.parse((await response.json()).resume).source).toBe(
      templates[0].source.replace("Alex Morgan", "Retained Draft"),
    );
    await page.getByLabel("Back to resumes", { exact: true }).click();
    await expect(
      page.locator(".resume-card").filter({ hasText: "Jake's Resume resume" }),
    ).toBeVisible();
    await assertDiagnostics(page);
  } finally {
    release.release();
    await page.unroute("**/api/workspace");
  }
});

test("deletion clears conflict and apply locks before creating another resume", async ({
  page,
}) => {
  const first = await createResume(page);
  await showAgent(page);
  const setting = page.getByLabel("Agent edits", { exact: true });
  await setting.selectOption("autonomous");
  await expect(setting).toHaveValue("autonomous");
  await expect(setting).toBeEnabled();
  const committed = deferred();
  const releaseAgent = deferred();
  await page.route("**/api/agent", async (route) => {
    const response = await route.fetch();
    expect(submissionResultSchema.parse(await response.json()).kind).toBe(
      "applied",
    );
    committed.release();
    await releaseAgent.promise;
    await route.fulfill({ response });
  });
  const deleteCurrent = async () => {
    await page.locator(".document-name").click();
    await page
      .getByRole("button", { name: "Delete resume", exact: true })
      .click();
    const deleted = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/workspace" &&
        response.request().method() === "POST" &&
        response.request().postDataJSON()?.op === "delete",
    );
    await page
      .getByRole("button", { name: "Delete resume", exact: true })
      .click();
    expect((await deleted).status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        name: "Create your first resume",
        exact: true,
      }),
    ).toBeVisible();
  };
  const accepted = deferred();
  const releaseAccept = deferred();
  try {
    await page
      .getByRole("button", { name: "Put skills first", exact: true })
      .click();
    await committed.promise;
    await first.editor.fill(
      templates[0].source.replace("Alex Morgan", "Discarded Test Draft"),
    );
    releaseAgent.release();
    await expect(page.locator(".draft-conflict")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await deleteCurrent();
    const second = await createResume(page);
    expect(second.id).not.toBe(first.id);
    await expect(second.editor).toBeEditable();
    await showAgent(page);
    await expect(setting).toHaveValue("review");
    await page.unroute("**/api/agent");
    await page
      .getByRole("button", { name: "Put skills first", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept", exact: true }),
    ).toBeVisible();
    await page.route("**/api/workspace", async (route) => {
      if (
        route.request().method() !== "POST" ||
        route.request().postDataJSON()?.op !== "decide"
      ) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      accepted.release();
      await releaseAccept.promise;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await accepted.promise;
    await expect(second.editor).toHaveAttribute("contenteditable", "false");
    await deleteCurrent();
    const third = await createResume(page);
    expect(third.id).not.toBe(second.id);
    releaseAccept.release();
    await page.waitForLoadState("networkidle");
    await expect(third.editor).toBeEditable();
    await expect(third.editor).not.toContainText("Discarded Test Draft");
    await expect(page.locator(".textLayer")).toContainText("Alex Morgan");
    await expect(setting).toHaveValue("review");
    const details = await page.request.get(
      `/api/workspace?id=${encodeURIComponent(third.id)}`,
    );
    expect(details.status()).toBe(200);
    expect(resumeSchema.parse((await details.json()).resume).source).toBe(
      templates[0].source,
    );
    await assertDiagnostics(page);
  } finally {
    releaseAgent.release();
    releaseAccept.release();
    await page.unroute("**/api/agent");
    await page.unroute("**/api/workspace");
  }
});
