import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { sanitize } from "./connected";
function diagnostics(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(sanitize(message.text()));
  });
  page.on("pageerror", (error) => errors.push(sanitize(error.message)));
  page.on("requestfailed", (request) =>
    errors.push(
      sanitize(`failed ${request.url()} ${request.failure()?.errorText}`),
    ),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(sanitize(`HTTP ${response.status()} ${response.url()}`));
  });
  return errors;
}
async function resolved(page: Page, dark: boolean) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--theme-dark")
          .trim(),
      ),
    )
    .toBe(dark ? "1" : "0");
  expect(
    await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor),
  ).toBe(dark ? "rgb(16, 16, 16)" : "rgb(255, 255, 255)");
}
test("system first paint, live OS changes, explicit preference persistence and cross-tab storage", async ({
  page,
  context,
}) => {
  const errors = diagnostics(page);
  await setupClerkTestingToken({ page });
  const workspaceRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/workspace")
      workspaceRequests.push(request.method());
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    new PerformanceObserver((list) => {
      for (const item of list.getEntries())
        if (item.name === "first-contentful-paint")
          document.documentElement.dataset.firstPaintTheme = getComputedStyle(
            document.documentElement,
          )
            .getPropertyValue("--theme-dark")
            .trim();
    }).observe({ type: "paint", buffered: true });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-paint-theme",
    "1",
  );
  await resolved(page, true);
  await page.emulateMedia({ colorScheme: "light" });
  await resolved(page, false);
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await resolved(page, true);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-paint-theme",
    "1",
  );
  await resolved(page, true);
  const second = await context.newPage();
  const secondErrors = diagnostics(second);
  try {
    await second.goto("/");
    await second.waitForLoadState("networkidle");
    await second.getByLabel("Theme", { exact: true }).selectOption("light");
    await resolved(page, false);
    await expect(page.getByLabel("Theme", { exact: true })).toHaveValue(
      "light",
    );
    await second.getByLabel("Theme", { exact: true }).selectOption("system");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    await page.emulateMedia({ colorScheme: "dark" });
    await resolved(page, true);
  } finally {
    await second.waitForLoadState("networkidle");
    await second.close();
  }
  expect(workspaceRequests).toEqual([]);
  expect([...errors, ...secondErrors]).toEqual([]);
  await writeFile(
    "artifacts/refresh-theme-diagnostics.json",
    JSON.stringify(errors),
  );
});
test("invalid preference defaults to system and denied theme storage stays usable in memory", async ({
  page,
}) => {
  const errors = diagnostics(page);
  await setupClerkTestingToken({ page });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.setItem("resume-tex-theme", "invalid");
    const nativeGet = Storage.prototype.getItem;
    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "resume-tex-theme")
        throw new DOMException("Denied", "SecurityError");
      return nativeGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "resume-tex-theme")
        throw new DOMException("Denied", "SecurityError");
      nativeSet.call(this, key, value);
    };
  });
  await page.goto("/");
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("system");
  await resolved(page, true);
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await resolved(page, false);
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await resolved(page, false);
  expect(errors).toEqual([]);
});

test("an invalid stored theme resolves to the live system preference", async ({
  page,
}) => {
  const errors = diagnostics(page);
  await setupClerkTestingToken({ page });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("resume-tex-theme", "invalid"),
  );
  await page.goto("/");
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await resolved(page, true);
  await page.emulateMedia({ colorScheme: "light" });
  await resolved(page, false);
  expect(errors).toEqual([]);
});
