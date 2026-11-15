import { test, expect } from "@playwright/test";
import { signIn, cleanup, sanitize } from "./connected";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { writeFile } from "node:fs/promises";
test("real Clerk session reaches private Convex workspace", async ({
  page,
}) => {
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
  try {
    await signIn(page);
    const response = await page.request.get("/api/workspace");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ resumes: [] });
    expect(errors).toEqual([]);
  } finally {
    await cleanup(page);
  }
});

test("embedded sign-in is usable across widths and both themes", async ({
  page,
}) => {
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
  await setupClerkTestingToken({ page });
  try {
    await page.goto("/");
    const identifier = page.locator('input[name="identifier"]');
    await expect(page.locator(".auth-widget form")).toBeVisible();
    await expect(page.locator(".auth-widget .cl-headerTitle")).toHaveText(
      "Sign in to Resume TeX",
    );
    await expect(identifier).toBeVisible();
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const theme of ["light", "dark"]) {
        await page.getByLabel("Theme", { exact: true }).selectOption(theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await expect(identifier).toBeFocused();
        await expect(identifier).toHaveCSS(
          "color",
          theme === "dark" ? "rgb(237, 237, 237)" : "rgb(32, 32, 32)",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        const widget = await page.locator(".auth-widget").boundingBox();
        if (!widget) throw new Error("Missing sign-in widget");
        expect(Math.abs(widget.x + widget.width / 2 - width / 2)).toBeLessThan(
          1,
        );
        await page.screenshot({
          path: `artifacts/sign-in-${width}-${theme}.png`,
        });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(
      "artifacts/sign-in-diagnostics.json",
      JSON.stringify(errors, null, 2),
    );
  }
});
