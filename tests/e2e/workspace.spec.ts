import { isNavigationCancellation } from "./diagnostics";
import {
  test,
  expect,
  type Page,
  type Request as BrowserRequest,
} from "@playwright/test";
import { z } from "zod";
import { resumeSchema } from "../../lib/core/schemas";
import { signIn, cleanup, sanitize } from "./connected";
import { templates as fixtures } from "../fixtures/templates";
import { mkdir, readFile, writeFile } from "node:fs/promises";
test.use({ video: "on" });
let latestDiagnostics: string[] = [];
type NavigationDiagnostics = {
  inflight: Set<BrowserRequest>;
  leaving: Set<BrowserRequest> | null;
  cancellations: string[];
};
const navigationDiagnostics = new WeakMap<Page, NavigationDiagnostics>();
test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = [];
  latestDiagnostics = errors;
  if (!testInfo.project.use.baseURL || !process.env.CLERK_FAPI)
    throw new Error("Browser origins are not configured");
  const appOrigin = new URL(testInfo.project.use.baseURL).origin;
  const clerkHost = new URL(
    process.env.CLERK_FAPI.includes("://")
      ? process.env.CLERK_FAPI
      : "https://" + process.env.CLERK_FAPI,
  ).hostname;
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(sanitize(`console: ${message.text()}`));
  });
  page.on("pageerror", (error) =>
    errors.push(sanitize(`pageerror: ${error.name}: ${error.message}`)),
  );
  const navigation: NavigationDiagnostics = {
    inflight: new Set(),
    leaving: null,
    cancellations: [],
  };
  navigationDiagnostics.set(page, navigation);
  page.on("request", (request) => navigation.inflight.add(request));
  page.on("requestfinished", (request) => navigation.inflight.delete(request));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    const message = sanitize(
      `requestfailed: ${request.method()} ${request.resourceType()} ${request.url()} ${failure}`,
    );
    if (
      isNavigationCancellation({
        recordedBeforeNavigation: navigation.leaving?.has(request) ?? false,
        method: request.method(),
        resourceType: request.resourceType(),
        url: request.url(),
        failure,
        appOrigin,
        clerkHost,
      })
    )
      navigation.cancellations.push(message);
    else errors.push(message);
    navigation.inflight.delete(request);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(sanitize(`http: ${response.status()} ${response.url()}`));
  });
  await signIn(page);
});
test.afterEach(async ({ page }, testInfo) => {
  try {
    await cleanup(page);
  } finally {
    await writeFile(
      `artifacts/navigation-cancellations-${testInfo.title.slice(0, 20).replace(/[^a-z0-9]/gi, "-")}.json`,
      JSON.stringify(
        navigationDiagnostics.get(page)?.cancellations ?? [],
        null,
        2,
      ),
    );
    await writeFile(
      `artifacts/diagnostics-${testInfo.title.slice(0, 20).replace(/[^a-z0-9]/gi, "-")}.json`,
      JSON.stringify(latestDiagnostics, null, 2),
    );
  }
});
function attachDiagnostics() {
  return latestDiagnostics;
}
async function newResume(page: Page, name: string) {
  await page.getByRole("button", { name: "New resume", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspace") &&
      response.request().method() === "POST",
  );
  await dialog
    .getByRole("button", {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .click();
  const pdfTab = page.getByRole("tab", { name: "PDF", exact: true });
  if ((page.viewportSize()?.width ?? 1440) <= 800) await pdfTab.click();
  await expect(page.locator(".textLayer")).toContainText("Experience");
  await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
  const sourceTab = page.getByRole("tab", { name: "LaTeX", exact: true });
  if (await sourceTab.isVisible()) await sourceTab.click();
  const blank = z
    .object({ resume: resumeSchema })
    .parse(await (await created).json()).resume;
  expect(blank.source).not.toMatch(/Alex|TypeScript|Example Labs/);
  const fixture = fixtures.find((template) => template.id === blank.template);
  if (!fixture) throw new Error("Missing test fixture");
  await page
    .getByRole("textbox", { name: "LaTeX source" })
    .fill(fixture.source);
  await page.keyboard.press("Control+s");
  if (await pdfTab.isVisible()) await pdfTab.click();
  await expect(page.locator(".textLayer")).toContainText("Alex");
  if (await sourceTab.isVisible()) await sourceTab.click();
  return resumeSchema.parse(
    (await (await page.request.get(`/api/workspace?id=${blank.id}`)).json())
      .resume,
  );
}
async function noOverflow(page: Page) {
  for (const control of await page
    .locator(
      ".editor-header button:visible, .editor-header select:visible, .editor-header a:visible",
    )
    .all()) {
    const box = await control.boundingBox();
    if (!box) throw new Error("A visible header control has no bounds");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(
      (page.viewportSize()?.width ?? 0) + 1,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
test("360px compile remains named and keyboard-operable in both themes", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await mkdir("artifacts/refresh-review", { recursive: true });
  await page.setViewportSize({ width: 360, height: 844 });
  await newResume(page, "Jake's Resume");
  const compile = page.locator(".compile-button");
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (let attempt = 0; attempt < 3; attempt++) {
      const opener = page.getByRole("button", {
        name: "Command menu (Ctrl+K)",
        exact: true,
      });
      await opener.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Search commands")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    await expect(compile.locator("span")).toBeHidden();
    await expect(compile).toHaveAccessibleName("Compile");
    await expect(compile).toBeEnabled();
    await noOverflow(page);
    const requested = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/compile" &&
        response.request().method() === "POST",
    );
    await compile.focus();
    await page.keyboard.press("Enter");
    const result = await requested;
    expect(result.status()).toBe(200);
    expect(z.object({ ok: z.boolean() }).parse(await result.json()).ok).toBe(
      true,
    );
    await expect(compile).toHaveAccessibleName("Compile");
    await expect(compile).toBeEnabled();
    await page.getByRole("tab", { name: "PDF", exact: true }).click();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
    await expect(page.locator(".textLayer")).toContainText("Alex");
    await page.getByRole("tab", { name: "LaTeX", exact: true }).click();
    await page.screenshot({
      path: "artifacts/refresh-review/360-" + theme + "-source.png",
    });
  }
  await page.getByLabel("Back to resumes", { exact: true }).click();
  await expect(page.locator(".library-heading h2")).toContainText("Resumes");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({
      width,
      height: width === 1440 ? 900 : width === 768 ? 1024 : 844,
    });
    for (const theme of ["light", "dark"]) {
      await page
        .locator('select[aria-label="Theme"]:visible')
        .selectOption(theme);
      await page.screenshot({
        path:
          "artifacts/refresh-review/" + width + "-" + theme + "-dashboard.png",
      });
    }
  }
  expect(errors).toEqual([]);
});

test("manual editor compiles, keeps failed PDF, restores history and exports source", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  const doc = await newResume(page, "Jake's Resume");
  await expect(
    page.getByRole("heading", { name: "Assistant", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Show assistant", { exact: true })).toHaveCount(
    0,
  );
  const source = page.getByRole("textbox", { name: "LaTeX source" });
  const updated = doc.source.replace("Alex Morgan", "Manual Verified");
  await source.fill(updated);
  await page.keyboard.press("Control+s");
  await expect(page.locator(".textLayer")).toContainText("Manual Verified");
  const good = await page.request.get(`/api/workspace?id=${doc.id}`);
  const saved = resumeSchema.parse((await good.json()).resume);
  expect(saved.source).toBe(updated);
  await source.fill(
    updated.replace(
      "\\begin{document}",
      "\\begin{document}\n\\unknownCommandForTest",
    ),
  );
  await page.keyboard.press("Control+s");
  await expect(page.locator(".compile-log")).toContainText(
    "Undefined control sequence",
  );
  await expect(page.locator(".textLayer")).toContainText("Manual Verified");
  await source.fill(updated);
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-status")).toHaveClass("save-status saved");
  await page.getByLabel("Version history", { exact: true }).click();
  const row = page.locator(".history-list article").filter({
    has: page.getByText(`Revision ${doc.revision}`, { exact: true }),
  });
  await row.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(source).toContainText("Alex Morgan");
  await expect(page.locator(".textLayer")).toContainText("Alex Morgan");
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await page
    .getByLabel("Job description", { exact: false })
    .fill("Required React and TypeScript experience");
  await page
    .getByRole("button", { name: "Analyze compiled PDF", exact: true })
    .click();
  await expect(
    page.getByText("Resume readiness", { exact: true }),
  ).toBeVisible();
  await page.getByText("What ATS sees", { exact: true }).click();
  await expect(page.getByTestId("ats-extracted-text")).toContainText(
    "Alex Morgan",
  );
  await expect(
    page.getByRole("button", { name: "Fix with assistant", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Close side panel", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Command menu (Ctrl+K)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Download LaTeX source", exact: false })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("resume.tex");
  const path = await file.path();
  if (!path) throw Error("Missing download");
  expect(await readFile(path, "utf8")).toBe(doc.source);
  expect(errors).toEqual([]);
});

test("templates and responsive source/PDF controls work without an Assistant", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  for (const name of ["Jake's Resume", "Deedy", "AltaCV", "moderncv"]) {
    await newResume(page, name);
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await noOverflow(page);
      for (const theme of ["light", "dark"]) {
        await page
          .locator('select[aria-label="Theme"]:visible')
          .selectOption(theme);
        const tab = page.getByRole("tab", { name: "PDF", exact: true });
        if (await tab.isVisible()) await tab.click();
        await expect(
          page.getByLabel("PDF page 1", { exact: true }),
        ).toBeVisible();
        const pdfRequests: string[] = [];
        const listener = (request: BrowserRequest) => {
          if (new URL(request.url()).pathname.startsWith("/api/pdf/"))
            pdfRequests.push(request.url());
        };
        page.on("request", listener);
        await page
          .getByRole("button", { name: "Zoom in", exact: true })
          .click();
        await expect(page.locator(".pdf-zoom")).toContainText("110%");
        await page
          .getByRole("button", { name: "Zoom out", exact: true })
          .click();
        await expect(page.locator(".pdf-zoom")).toContainText("100%");
        await expect(page.locator(".textLayer")).toContainText("Alex");
        page.off("request", listener);
        expect(pdfRequests).toEqual([]);
        await page.screenshot({
          path: `artifacts/editor-${name.replace(/[^a-z]/gi, "")}-${width}-${theme}-pdf.png`,
        });
        const source = page.getByRole("tab", { name: "LaTeX", exact: true });
        if (await source.isVisible()) await source.click();
        await page.screenshot({
          path: `artifacts/editor-${name.replace(/[^a-z]/gi, "")}-${width}-${theme}-source.png`,
        });
      }
    }
    await page.getByLabel("Back to resumes", { exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  expect(errors).toEqual([]);
});

test("PDF preview bounds visible canvases and releases them while scrolling", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await newResume(page, "Jake's Resume");
  const source =
    String.raw`\documentclass{article}
\begin{document}
` +
    Array.from(
      { length: 12 },
      (_, index) => `Page ${index + 1} content.\\newpage\n`,
    ).join("") +
    String.raw`\end{document}`;
  await page.getByRole("textbox", { name: "LaTeX source" }).fill(source);
  await page.keyboard.press("Control+s");
  await expect(page.locator(".pdf-controls")).toContainText("12 pages");
  await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
  const initialCanvases = await page.locator(".pdf-sheet canvas").count();
  expect(initialCanvases).toBeLessThan(6);
  expect(
    await page
      .locator(".pdf-sheet canvas")
      .evaluateAll((canvases) =>
        canvases.every(
          (canvas) =>
            canvas instanceof HTMLCanvasElement &&
            canvas.width * canvas.height <= 4_010_000,
        ),
      ),
  ).toBe(true);
  await page.locator(".pdf-pages").evaluate((element) => {
    element.lastElementChild?.scrollIntoView({ block: "start" });
  });
  await expect(page.getByLabel("PDF page 12", { exact: true })).toBeVisible();
  await expect(page.locator(".textLayer")).toContainText("Page 12 content.");
  await expect(page.getByLabel("PDF page 1", { exact: true })).toHaveCount(0);
  expect(await page.locator(".pdf-sheet canvas").count()).toBeLessThan(6);
  await writeFile(
    "artifacts/pdf-render-budget.json",
    JSON.stringify(
      {
        pages: 12,
        initialCanvases,
        finalCanvases: await page.locator(".pdf-sheet canvas").count(),
        pixelCounts: await page
          .locator(".pdf-sheet canvas")
          .evaluateAll((canvases) =>
            canvases.map((canvas) =>
              canvas instanceof HTMLCanvasElement
                ? canvas.width * canvas.height
                : 0,
            ),
          ),
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: "artifacts/multipage-pdf.png" });
  await page.getByLabel("Back to resumes", { exact: true }).click();
  await expect(page.locator(".pdf-sheet canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
