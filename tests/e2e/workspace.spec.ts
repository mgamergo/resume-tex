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
import { readFile, writeFile } from "node:fs/promises";
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
    const message = sanitize(`requestfailed: ${request.url()} ${failure}`);
    if (
      isNavigationCancellation({
        recordedBeforeNavigation: navigation.leaving?.has(request) ?? false,
        method: request.method(),
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
async function askRewrite(page: Page, waitForProposal = true) {
  await page
    .getByLabel("Ask for a targeted change")
    .fill(
      'Replace only the first bullet sentence "Built a TypeScript dashboard used by 120 teammates to review service health." with "Built a service-health dashboard in TypeScript for 120 teammates." Use rewrite_bullet or an exact range_patch and preserve every other character.',
    );
  const requested = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/agent" &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Propose", exact: true }).click();
  const body = z
    .object({ instruction: z.string().min(1), call: z.never().optional() })
    .parse((await requested).postDataJSON());
  expect(body.instruction).toContain("Replace only");
  if (waitForProposal)
    await expect(page.locator(".proposal-card")).toContainText(
      "service-health dashboard",
      { timeout: 45_000 },
    );
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
  await expect(page.locator(".textLayer")).toContainText("Experience");
  const pdfTab = page.getByRole("tab", { name: "PDF", exact: true });
  if (await pdfTab.isVisible()) await pdfTab.click();
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
  await expect(page.locator(".textLayer")).toContainText("Alex");
  return resumeSchema.parse(
    (await (await page.request.get(`/api/workspace?id=${blank.id}`)).json())
      .resume,
  );
}
async function hardNavigation(page: Page, action: "open" | "reload") {
  await page.waitForLoadState("networkidle");
  const diagnostics = navigationDiagnostics.get(page);
  if (diagnostics) diagnostics.leaving = new Set(diagnostics.inflight);
  try {
    if (action === "open") await page.goto("/", { waitUntil: "networkidle" });
    else await page.reload({ waitUntil: "networkidle" });
  } finally {
    if (diagnostics) diagnostics.leaving = null;
  }
  await expect(
    page.getByRole("button", { name: "New resume", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".loading-state")).toHaveCount(0);
}
async function openDashboard(page: Page) {
  await hardNavigation(page, "open");
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
test("source edit → save → actual PDF, review/accept/reject/undo, ATS, history, downloads and deletion", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await expect(
    page.getByRole("heading", { name: "My resumes", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await noOverflow(page);
  const primary = page.getByRole("button", { name: "New resume", exact: true });
  expect(
    await primary.evaluate((button) => getComputedStyle(button).color),
  ).toBe("rgb(255, 255, 255)");
  expect(
    await primary.evaluate((button) => getComputedStyle(button).outlineStyle),
  ).toBe("none");
  await primary.focus();
  expect(
    await primary.evaluate((button) => getComputedStyle(button).outlineStyle),
  ).toBe("solid");
  await primary.evaluate((button) => button.blur());
  const created = await newResume(page, "Jake's Resume");
  await page.getByLabel("Hide side panel").click();
  const source = page.getByRole("textbox", { name: "LaTeX source" });
  const original = created.source;
  expect(original).toContain("Alex Morgan");
  await source.fill(original.replace("Alex Morgan", "Jamie Verified"));
  await source.press("Control+s");
  await expect(page.locator(".textLayer")).toContainText("Jamie Verified");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  expect(
    await page.getByLabel("PDF page 1", { exact: true }).evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext("2d");
      if (!context) return false;
      return context
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, index) => index % 4 !== 3 && value < 150);
    }),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Show assistant", { exact: true }).click();
  await askRewrite(page);
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  await expect(source).toContainText("Built a TypeScript dashboard");
  await page.screenshot({
    path: "artifacts/proposal-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(source).toContainText("Built a service-health dashboard");
  await expect(page.locator(".textLayer")).toContainText(
    "service-health dashboard",
  );
  await page
    .getByRole("button", { name: "Undo proposal", exact: true })
    .click();
  await expect(source).toContainText("Built a TypeScript dashboard");
  await page.getByRole("button", { name: "Put skills first" }).click();
  await expect(
    page.getByRole("button", { name: "Reject", exact: true }),
  ).toBeVisible();
  const beforeReject = await source.innerText();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveCount(0);
  expect(await source.innerText()).toBe(beforeReject);
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await page
    .getByLabel("Job description", { exact: false })
    .fill(
      "Requirements\n- React\n- TypeScript\n- Node.js\n- Kubernetes\nNice to have\n- Docker",
    );
  await page.getByRole("button", { name: "Analyze compiled PDF" }).click();
  await expect(
    page.getByText("Resume readiness", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".keyword-tags .missing")).toContainText([
    "kubernetes",
  ]);
  await page.screenshot({
    path: "artifacts/ats-score-desktop.png",
    fullPage: true,
  });
  await page.getByText("What ATS sees", { exact: true }).click();
  await expect(page.getByTestId("ats-extracted-text")).toContainText(
    "Jamie Verified",
  );
  await expect(page.getByTestId("ats-extracted-text")).not.toContainText(
    "documentclass",
  );
  await page.screenshot({ path: "artifacts/ats-desktop.png", fullPage: true });
  await page
    .getByLabel("Job description", { exact: false })
    .fill("Required React component testing and accessible workflows");
  await expect(page.locator(".ats-results .stale-proposal")).toContainText(
    "job description",
  );
  await page.getByLabel("Show assistant", { exact: true }).click();
  await page
    .getByRole("button", { name: "Tailor to the job", exact: true })
    .click();
  await expect(page.locator(".proposal-card")).toContainText(
    "Prioritize relevant evidence",
  );
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByLabel("Version history", { exact: true }).click();
  const first = page
    .locator(".history-list article")
    .filter({ has: page.getByText("Revision 2", { exact: true }) });
  await first.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(source).toContainText("Alex Morgan");
  await expect(page.locator(".textLayer")).toContainText("Alex Morgan");
  await expect(page.locator(".save-status")).toHaveClass("save-status saved");
  await page.locator(".document-name").click();
  await page.getByLabel("Resume name").fill("Verified product engineer");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator(".document-name")).toContainText(
    "Verified product engineer",
  );
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search commands").fill("Download LaTeX");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download LaTeX source" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("resume.tex");
  await download.saveAs("artifacts/downloaded-resume.tex");
  await page.getByLabel("Back to resumes", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verified product engineer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Verified product engineer/ }).click();
  await expect(source).toBeVisible();
  await page.locator(".document-name").click();
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete resume", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your first resume" }),
  ).toBeVisible();
  await writeFile(
    "artifacts/workflow-diagnostics.json",
    JSON.stringify(errors, null, 2),
  );
  expect(errors).toEqual([]);
});
test("all templates render and desktop/tablet/mobile controls, dark theme and screenshots remain usable", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver;
    const active = new Set<ResizeObserver>();
    const publish = () => {
      document.documentElement.dataset.pdfObservers = String(active.size);
    };
    window.ResizeObserver = class extends NativeObserver {
      override observe(target: Element, options?: ResizeObserverOptions) {
        super.observe(target, options);
        if (target.classList.contains("pdf-pages")) {
          active.add(this);
          publish();
        }
      }
      override disconnect() {
        super.disconnect();
        active.delete(this);
        publish();
      }
      override unobserve(target: Element) {
        super.unobserve(target);
        if (target.classList.contains("pdf-pages")) {
          active.delete(this);
          publish();
        }
      }
    };
  });
  await openDashboard(page);
  for (const name of ["Deedy", "AltaCV-style", "moderncv", "Jake's Resume"]) {
    await newResume(page, name);
    await expect(page.locator(".textLayer")).toContainText("TypeScript");
    await page.getByLabel("Back to resumes", { exact: true }).click();
  }
  await page
    .getByRole("button", { name: /Jake's Resume resume/ })
    .first()
    .click();
  await expect(page.locator(".textLayer")).toContainText("Alex");
  await page.getByLabel("Hide side panel").click();
  const separator = page.getByRole("separator", {
    name: "Resize source and PDF",
  });
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "51");
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const commandMenu = page.getByRole("button", {
      name: "Command menu (Ctrl+K)",
      exact: true,
    });
    await commandMenu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Search commands")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(commandMenu).toBeFocused();
    const renameOpener = page.locator(".document-name");
    await renameOpener.click();
    await expect(page.getByLabel("Resume name")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(renameOpener).toBeFocused();
    for (const tab of ["PDF", "Assistant", "ATS check"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await commandMenu.click();
      await page.getByLabel("Search commands").fill("Find in source");
      await page
        .getByRole("button", { name: "Find in source", exact: true })
        .click();
      await expect(
        page.getByRole("tab", { name: "LaTeX", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      const search = page.locator('.cm-search input[name="search"]');
      await expect(search).toBeVisible();
      await expect(search).toBeFocused();
      await search.fill("");
      await search.pressSequentially("Alex");
      await expect(page.locator(".cm-searchMatch").first()).toBeVisible();
      await page.screenshot({
        path: `artifacts/editor-${viewport.width}-find-${tab.replaceAll(" ", "-")}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("textbox", { name: "LaTeX source", exact: true }),
      ).toBeFocused();
    }
    await commandMenu.click();
    await page.getByLabel("Search commands").fill("Version history");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Version history", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Version history", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await commandMenu.click();
    await page.getByLabel("Search commands").fill("Download LaTeX");
    const mobileDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download LaTeX source", exact: true })
      .click();
    const downloadedSource = await (await mobileDownload).path();
    if (!downloadedSource)
      throw new Error("Source download did not produce a file");
    expect(await readFile(downloadedSource, "utf8")).toContain(
      "\\documentclass",
    );
    await page.getByRole("tab", { name: "LaTeX", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "LaTeX source" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `artifacts/editor-${viewport.width}-source.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "PDF", exact: true }).click();
    await expect(page.getByLabel("PDF page 1", { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `artifacts/editor-${viewport.width}-pdf.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "Assistant", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assistant" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/editor-${viewport.width}-assistant.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "ATS check", exact: true }).click();
    await expect(
      page.getByLabel("Job description", { exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/editor-${viewport.width}-ats.png`,
      fullPage: true,
    });
  }
  await page
    .getByLabel("Theme", { exact: true })
    .filter({ visible: true })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("tab", { name: "LaTeX", exact: true }).click();
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  for (let step = 0; step < 6; step++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(async () => {
      const paper = await page.locator(".pdf-sheet").boundingBox();
      const viewport = await page.locator(".pdf-pages").boundingBox();
      return !!paper && !!viewport && paper.x >= viewport.x - 1;
    })
    .toBe(true);
  await page.screenshot({
    path: "artifacts/editor-mobile-zoom.png",
    fullPage: true,
  });
  for (let step = 0; step < 6; step++)
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator(".textLayer")).toContainText("Alex");
  await expect(page.locator("html")).toHaveAttribute("data-pdf-observers", "1");
  await page.getByRole("tab", { name: "LaTeX", exact: true }).click();
  const token = page
    .locator(".cm-content span")
    .filter({ hasText: "documentclass" })
    .first();
  expect(
    await token.evaluate((element) => {
      const editor = element.closest(".cm-editor");
      if (!editor) return 0;
      const luminance = (color: string) => {
        const values = (color.match(/[\d.]+/g) ?? [])
          .slice(0, 3)
          .map((value) => {
            const component = Number(value) / 255;
            return component <= 0.04045
              ? component / 12.92
              : ((component + 0.055) / 1.055) ** 2.4;
          });
        return (
          (values[0] ?? 0) * 0.2126 +
          (values[1] ?? 0) * 0.7152 +
          (values[2] ?? 0) * 0.0722
        );
      };
      const text = luminance(getComputedStyle(element).color);
      const background = luminance(getComputedStyle(editor).backgroundColor);
      return (
        (Math.max(text, background) + 0.05) /
        (Math.min(text, background) + 0.05)
      );
    }),
  ).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({
    path: "artifacts/editor-mobile-dark.png",
    fullPage: true,
  });
  await page.getByLabel("Back to resumes", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-pdf-observers", "0");
  await noOverflow(page);
  await page.screenshot({
    path: "artifacts/dashboard-mobile-dark.png",
    fullPage: true,
  });
  await hardNavigation(page, "reload");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByLabel("Theme", { exact: true })
    .filter({ visible: true })
    .selectOption("light");
  await page.setViewportSize({ width: 768, height: 1024 });
  await noOverflow(page);
  await page.screenshot({
    path: "artifacts/dashboard-tablet.png",
    fullPage: true,
  });
  await writeFile(
    "artifacts/responsive-diagnostics.json",
    JSON.stringify(errors, null, 2),
  );
  expect(errors).toEqual([]);
});
test("debounced compile, failed compile retention, targeted ATS fixes, evidence and engine freshness", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await openDashboard(page);
  const created = await newResume(page, "Jake's Resume");
  await page.getByLabel("Hide side panel").click();
  const source = page.getByRole("textbox", { name: "LaTeX source" });
  const edited = created.source.replace("Alex Morgan", "Taylor Checked");
  await source.fill(edited);
  await expect(page.locator(".textLayer")).toContainText("Taylor Checked");
  const invalid = edited.replace(
    "\\section{Experience}",
    "\\secton{Experience}",
  );
  await source.fill(invalid);
  await source.press("Control+s");
  await expect(page.getByText("Out of date", { exact: true })).toBeVisible();
  await expect(page.locator(".textLayer")).toContainText("Taylor Checked");
  const diagnostic = page
    .locator(".diagnostic")
    .filter({ hasText: "Undefined control sequence" })
    .first();
  await expect(diagnostic).toBeVisible();
  await diagnostic.click();
  await expect(source).toBeFocused();
  const header = edited
    .replace("\\section{Skills}", "\\section{Toolbox}")
    .replace("120 teammates", "teammates")
    .replace("35\\%", "a measurable amount");
  await source.fill(header);
  await source.press("Control+s");
  await expect(page.getByText("Out of date", { exact: true })).toHaveCount(0);
  if (await page.getByLabel("Close compile log").isVisible())
    await page.getByLabel("Close compile log").click();
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze compiled PDF" }).click();
  const sections = page
    .locator(".findings article")
    .filter({ hasText: "Recognizable sections" });
  await sections.getByRole("button", { name: "Fix with assistant" }).click();
  await expect(page.locator(".proposal-card")).toContainText(
    "recognizable Skills heading",
  );
  let releaseReject: () => void = () => {};
  let rejectReady: () => void = () => {};
  const rejectGate = new Promise<void>((resolve) => {
    releaseReject = resolve;
  });
  const rejection = new Promise<void>((resolve) => {
    rejectReady = resolve;
  });
  const heldReject = async (route: import("@playwright/test").Route) => {
    const input = route.request().postDataJSON();
    if (input?.op !== "decide" || input.accept !== false) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    rejectReady();
    await rejectGate;
    await route.fulfill({ response });
  };
  await page.route("**/api/workspace", heldReject);
  try {
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await rejection;
    await page.getByLabel("Show ATS check", { exact: true }).click();
    await expect(
      sections.getByRole("button", { name: "Fix with assistant" }),
    ).toBeDisabled();
    releaseReject();
    await expect(
      sections.getByRole("button", { name: "Fix with assistant" }),
    ).toBeEnabled();
  } finally {
    releaseReject();
    await page.unroute("**/api/workspace", heldReject);
  }

  await sections.getByRole("button", { name: "Fix with assistant" }).click();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze compiled PDF" }).click();
  const impact = page
    .locator(".findings article")
    .filter({ hasText: "Evidence of impact" });
  await impact.getByRole("button", { name: "Add verified evidence" }).click();
  await page
    .getByLabel("Verified outcome")
    .fill("Saved 12 hours each month, measured in our support log.");
  await page.getByRole("button", { name: "Review evidence proposal" }).click();
  await expect(page.locator(".proposal-card")).toContainText("12 hours");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.locator(".textLayer")).toContainText("12 hours");
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await page.getByRole("button", { name: "Analyze compiled PDF" }).click();
  await expect(page.locator(".ats-results .stale-proposal")).toHaveCount(0);
  await page.getByLabel("LaTeX engine").selectOption("xelatex");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ats-results .stale-proposal")).toContainText(
    "Source changed",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF", exact: true }).click();
  const downloaded = await downloadPromise;
  await downloaded.saveAs("artifacts/verified-resume.pdf");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile("artifacts/verified-resume.pdf");
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const { extractPdf } = await import("../../lib/server/pdf-text");
  expect((await extractPdf(bytes)).text).toContain("12 hours");
  await page.screenshot({
    path: "artifacts/ats-targeted-fixes.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("late assistant, acceptance and ATS responses cannot replace another open resume", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  const make = async (name: string, template: string) => {
    const response = await page.request.post("/api/workspace", {
      data: { op: "create", name, template },
    });
    const blank = z
      .object({ resume: resumeSchema })
      .parse(await response.json()).resume;
    const fixture = fixtures.find((item) => item.id === template);
    if (!fixture) throw new Error("Missing test fixture");
    return z.object({ resume: resumeSchema }).parse(
      await (
        await page.request.post("/api/workspace", {
          data: {
            op: "save",
            id: blank.id,
            baseDigest: blank.digest,
            expectedRevision: blank.revision,
            source: fixture.source,
            engine: blank.engine,
          },
        })
      ).json(),
    ).resume;
  };
  const a = await make("Race A", "jake");
  const b = await make("Race B", "jake");
  const bSaved = z.object({ resume: resumeSchema }).parse(
    await (
      await page.request.post("/api/workspace", {
        data: {
          op: "save",
          id: b.id,
          baseDigest: b.digest,
          expectedRevision: b.revision,
          source: b.source.replace("Alex Morgan", "B Person"),
          engine: b.engine,
        },
      })
    ).json(),
  ).resume;
  expect(bSaved.name).toBe("Race B");
  await openDashboard(page);
  const open = async (name: string) => {
    await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
    await expect(page.locator(".document-name")).toContainText(name);
    await expect(page.locator(".textLayer")).toContainText(
      name === "Race B" ? "B Person" : "Alex",
    );
  };
  const home = async () => {
    await page.getByLabel("Back to resumes", { exact: true }).click();
    await expect(page.getByRole("button", { name: /^Race B / })).toBeVisible();
  };
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  const hold = async (pattern: string, operation?: string) => {
    let readyResolve: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });
    let releaseResolve: () => void = () => {};
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    let doneResolve: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      doneResolve = resolve;
    });
    const handler = async (route: import("@playwright/test").Route) => {
      if (operation && route.request().postDataJSON()?.op !== operation) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      readyResolve();
      await release;
      await route.fulfill({ response });
      doneResolve();
    };
    await page.route(pattern, handler);
    return {
      ready,
      finish: async () => {
        releaseResolve();
        await done;
        await settle();
        await page.unroute(pattern, handler);
      },
    };
  };
  await open(a.name);
  const proposal = await hold("**/api/agent");
  await askRewrite(page, false);
  await proposal.ready;
  await home();
  await open(b.name);
  await proposal.finish();
  await expect(page.locator(".document-name")).toContainText("Race B");
  await expect(page.locator(".proposal-card")).toHaveCount(0);
  await home();
  await open(a.name);
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  const acceptance = await hold("**/api/workspace", "decide");
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await acceptance.ready;
  await home();
  await open(b.name);
  await acceptance.finish();
  await expect(page.locator(".document-name")).toContainText("Race B");
  await expect(
    page.getByRole("textbox", { name: "LaTeX source" }),
  ).toContainText("B Person");
  await expect(
    page.getByRole("textbox", { name: "LaTeX source" }),
  ).not.toContainText("service-health dashboard");
  await home();
  await open(a.name);
  await page.getByLabel("Show ATS check", { exact: true }).click();
  const analysis = await hold("**/api/ats");
  await page.getByRole("button", { name: "Analyze compiled PDF" }).click();
  await analysis.ready;
  await home();
  await open(b.name);
  await analysis.finish();
  await page.getByLabel("Show ATS check", { exact: true }).click();
  await expect(page.locator(".document-name")).toContainText("Race B");
  await expect(page.getByText("Resume readiness", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator(".textLayer")).toContainText("B Person");
  expect(errors).toEqual([]);
});

test("same-resume apply locks prevent lost typing and new resumes have independent undo history", async ({
  page,
}) => {
  const errors = attachDiagnostics();
  await openDashboard(page);
  const doc = await newResume(page, "Jake's Resume");
  const source = page.getByRole("textbox", { name: "LaTeX source" });
  await askRewrite(page);
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  for (const operation of ["decide", "restore"]) {
    let readyResolve: () => void = () => {};
    let releaseResolve: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    const handler = async (route: import("@playwright/test").Route) => {
      if (route.request().postDataJSON()?.op !== operation) {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      readyResolve();
      await release;
      await route.fulfill({ response });
    };
    await page.route("**/api/workspace", handler);
    try {
      if (operation === "decide")
        await page.getByRole("button", { name: "Accept", exact: true }).click();
      else {
        await page.getByLabel("Version history", { exact: true }).click();
        await page
          .locator(".history-list article")
          .filter({ has: page.getByText("Revision 2", { exact: true }) })
          .getByRole("button", { name: "Restore", exact: true })
          .click();
      }
      await ready;
      if (operation === "restore") await page.keyboard.press("Escape");
      await expect(source).toHaveAttribute("contenteditable", "false");
      await expect(
        page.getByRole("button", { name: "Put skills first", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Tighten a bullet", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Propose", exact: true }),
      ).toBeDisabled();
      if (operation === "decide")
        await expect(
          page.getByRole("button", { name: "Reject", exact: true }),
        ).toBeDisabled();
      await expect(
        page.getByLabel("LaTeX engine", { exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByLabel("Undo source edit", { exact: true }),
      ).toBeDisabled();
      await source.evaluate((element) => element.focus());
      await page.keyboard.type("SHOULD_NOT_OVERWRITE");
      await expect(source).not.toContainText("SHOULD_NOT_OVERWRITE");
      await page.screenshot({ path: `artifacts/apply-lock-${operation}.png` });
      releaseResolve();
      await expect(source).toHaveAttribute("contenteditable", "true");
      const expected =
        operation === "decide"
          ? "Built a service-health dashboard"
          : "Built a TypeScript dashboard";
      await expect(source).toContainText(expected);
      const detail = await (
        await page.request.get(`/api/workspace?id=${doc.id}`)
      ).json();
      expect(resumeSchema.parse(detail.resume).source).toContain(expected);
    } finally {
      releaseResolve();
      await page.unroute("**/api/workspace", handler);
    }
  }
  await source.fill(
    doc.source.replace("Alex Morgan", "Private Previous Resume"),
  );
  await page.keyboard.press("Control+s");
  await expect(page.locator(".textLayer")).toContainText(
    "Private Previous Resume",
  );
  await page.keyboard.press("Control+k");
  await page
    .getByRole("button", { name: "New resume from template", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /Deedy/ }).click();
  await expect(page.locator(".document-name")).toContainText("Deedy");
  await expect(source).toContainText("\\selectfont\\strut");
  await page.getByLabel("Undo source edit", { exact: true }).click();
  await expect(source).toContainText("\\selectfont\\strut");
  await expect(source).not.toContainText("Private Previous Resume");
  const deedy = fixtures.find((item) => item.id === "deedy");
  if (!deedy) throw new Error("Missing test fixture");
  await source.fill(deedy.source);
  await page.keyboard.press("Control+s");
  await expect(page.locator(".textLayer")).toContainText("Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Assistant", exact: true }).click();
  await askRewrite(page);
  await expect(page.locator(".proposal-card")).toContainText(
    "service-health dashboard",
  );
  await noOverflow(page);
  await page.screenshot({ path: "artifacts/editor-390-proposal.png" });
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("tab", { name: "PDF", exact: true }).click();
  await expect(page.locator(".textLayer")).toContainText(
    "service-health dashboard",
  );
  await page.getByRole("tab", { name: "ATS check", exact: true }).click();
  await page
    .getByLabel("Job description", { exact: false })
    .fill("Required React.\nNice to have: Docker and Kubernetes.");
  await page
    .getByRole("button", { name: "Analyze compiled PDF", exact: true })
    .click();
  await expect(
    page.getByText("Resume readiness", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".keyword-tags .missing")).toContainText(
    "kubernetes",
  );
  await noOverflow(page);
  await page.screenshot({ path: "artifacts/editor-390-ats-score.png" });
  expect(errors).toEqual([]);
});

test.describe("visual evidence", () => {
  test("refreshed light and dark workspace evidence across desktop tablet and phone", async ({
    page,
  }) => {
    const errors = attachDiagnostics();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ["light", "dark"]) {
        await openDashboard(page);
        await page
          .getByLabel("Theme", { exact: true })
          .filter({ visible: true })
          .selectOption(theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator(".loading-state")).toHaveCount(0);
        await noOverflow(page);
        const prefix = `artifacts/refresh-after/${viewport.width}-${theme}`;
        await page.screenshot({
          path: `${prefix}-dashboard.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "View all templates", exact: true })
          .click();
        await noOverflow(page);
        await page.screenshot({
          path: `${prefix}-templates.png`,
          fullPage: true,
        });
        await openDashboard(page);
        await newResume(page, "Jake's Resume");
        const opposite = theme === "dark" ? "light" : "dark";
        await page
          .getByLabel("Theme", { exact: true })
          .filter({ visible: true })
          .selectOption(opposite);
        const oppositeClasses = await page
          .locator(".cm-editor")
          .getAttribute("class");
        await page
          .getByLabel("Theme", { exact: true })
          .filter({ visible: true })
          .selectOption(theme);
        await expect(page.locator(".cm-editor")).not.toHaveAttribute(
          "class",
          oppositeClasses ?? "",
        );
        await noOverflow(page);
        await page.screenshot({ path: `${prefix}-source.png` });
        if (viewport.width <= 768)
          await page.getByRole("tab", { name: "PDF", exact: true }).click();
        await expect(
          page.getByLabel("PDF page 1", { exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: `${prefix}-pdf.png` });
        if (viewport.width <= 768)
          await page
            .getByRole("tab", { name: "Assistant", exact: true })
            .click();
        await page
          .getByRole("button", { name: "Put skills first", exact: true })
          .click();
        await expect(page.locator(".proposal-card")).toBeVisible();
        await noOverflow(page);
        await page.screenshot({ path: `${prefix}-assistant.png` });
        await page.getByRole("button", { name: "Reject", exact: true }).click();
        if (viewport.width <= 768)
          await page
            .getByRole("tab", { name: "ATS check", exact: true })
            .click();
        else await page.getByLabel("Show ATS check", { exact: true }).click();
        await page
          .getByLabel("Job description", { exact: false })
          .fill("Required React and TypeScript. Nice to have: Kubernetes.");
        await page
          .getByRole("button", { name: "Analyze compiled PDF", exact: true })
          .click();
        await expect(
          page.getByText("Resume readiness", { exact: true }),
        ).toBeVisible();
        await expect(page.locator(".keyword-tags .missing")).toContainText(
          "kubernetes",
        );
        await noOverflow(page);
        await page.screenshot({ path: `${prefix}-ats.png` });
      }
    }
    expect(errors).toEqual([]);
  });
});
