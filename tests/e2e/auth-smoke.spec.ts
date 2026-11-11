import { test, expect } from "@playwright/test";
import { signIn, cleanup, sanitize } from "./connected";
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
