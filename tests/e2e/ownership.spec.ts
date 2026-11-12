import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { signIn, cleanup, sanitize } from "./connected";
import { resumeSchema } from "../../lib/core/schemas";
import { writeFile } from "node:fs/promises";
test("real accounts isolate resumes, revisions, proposals and PDFs; stale saves conflict and signout clears source", async ({
  page,
  request,
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
    const anonymous = await request.get("/api/workspace");
    expect(anonymous.status()).toBe(401);
    await signIn(page);
    const createdResponse = await page.request.post("/api/workspace", {
      data: { op: "create", name: "Private ownership check", template: "jake" },
    });
    expect(createdResponse.status()).toBe(200);
    const doc = resumeSchema.parse((await createdResponse.json()).resume);
    const input = {
      op: "save",
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      engine: doc.engine,
      source: doc.source.replace(
        "\\section{Experience}",
        "\\section{Experience}\nPrivate account evidence.",
      ),
    };
    const save = await page.request.post("/api/workspace", { data: input });
    expect(save.status()).toBe(200);
    const saved = resumeSchema.parse((await save.json()).resume);
    expect(saved.revision).toBe(2);
    const stale = await page.request.post("/api/workspace", {
      data: { ...input, source: doc.source + "\n" },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toBe("Revision conflict");
    await page.reload();
    await page.getByRole("button", { name: /Private ownership check/ }).click();
    await expect(
      page.getByRole("textbox", { name: "LaTeX source" }),
    ).toContainText("Private account evidence.");
    await expect(page.locator(".textLayer")).toContainText(
      "Private account evidence.",
    );
    const compiled = await (
      await page.request.post("/api/compile", { data: { id: doc.id } })
    ).json();
    expect(compiled.ok).toBe(true);
    await clerk.signOut({ page });
    await expect(
      page.getByRole("textbox", { name: "LaTeX source" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    expect(
      (await page.request.get(`/api/workspace?id=${doc.id}`)).status(),
    ).toBe(401);
    expect(
      (await page.request.get(`/api/pdf/${compiled.artifact}`)).status(),
    ).toBe(401);
    await signIn(page);
    const list = await page.request.get("/api/workspace");
    expect(await list.json()).toEqual({ resumes: [] });
    expect(
      (await page.request.get(`/api/workspace?id=${doc.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/workspace", {
          data: {
            op: "save",
            id: saved.id,
            baseDigest: saved.digest,
            expectedRevision: saved.revision,
            source: "stolen",
            engine: saved.engine,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/workspace", {
          data: {
            op: "restore",
            id: saved.id,
            revision: 1,
            baseDigest: saved.digest,
            expectedRevision: saved.revision,
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/pdf/${compiled.artifact}`)).status(),
    ).toBe(404);
    await expect(page.locator("body")).not.toContainText(
      "Private account evidence.",
    );
    expect(errors).toEqual([]);
    await writeFile(
      "artifacts/refresh-ownership-diagnostics.json",
      JSON.stringify(errors),
    );
  } finally {
    await cleanup(page);
  }
});
