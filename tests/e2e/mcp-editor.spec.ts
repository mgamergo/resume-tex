import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { signIn, cleanup, sanitize } from "./connected";
import { resumeSchema } from "../../lib/core/schemas";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createHash, randomBytes } from "node:crypto";
import job from "../fixtures/job-listing.json";
import { extractPdf } from "../fixtures/pdf-text";
test.use({ screenshot: "off", trace: "off", video: "off" });
const textResult = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
});
test("private MCP keys authorize agents, export real PDF, reconcile edits, and revoke access", async ({
  page,
  request,
  baseURL,
}) => {
  const diagnostics: string[] = [];
  const expected: string[] = [];
  let conflictStage = false;
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (
        conflictStage &&
        /^Failed to load resource: the server responded with a status of 409/.test(
          message.text(),
        )
      )
        expected.push("console 409");
      else diagnostics.push(sanitize(message.text()));
    }
  });
  page.on("pageerror", (error) => diagnostics.push(sanitize(error.message)));
  page.on("requestfailed", (request) =>
    diagnostics.push(
      sanitize(`failed ${request.url()} ${request.failure()?.errorText}`),
    ),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const req = response.request();
      if (
        conflictStage &&
        response.status() === 409 &&
        new URL(response.url()).pathname === "/api/workspace" &&
        req.method() === "POST" &&
        req.postData()?.includes("local unsaved draft")
      )
        expected.push("stale manual save 409");
      else
        diagnostics.push(
          sanitize(`HTTP ${response.status()} ${response.url()}`),
        );
    }
  });
  const identity = z
    .object({ userId: z.string(), runId: z.string() })
    .parse(JSON.parse(await readFile(".data/mcp-test-owner.json", "utf8")));
  const clients: Client[] = [];
  try {
    await signIn(page, identity);
    await page.getByRole("button", { name: "New resume", exact: true }).click();
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/workspace") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Jake's Resume/ })
      .click();
    const doc = resumeSchema.parse((await (await created).json()).resume);
    await expect(page.locator(".textLayer")).toContainText("Experience");
    const anonymous = await request.post("/api/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "initialize" },
    });
    expect(anonymous.status()).toBe(401);
    const forged = await request.post("/api/mcp", {
      headers: { Authorization: `Bearer rtx_${"cd".repeat(32)}` },
      data: {},
    });
    expect(forged.status()).toBe(401);
    await page.getByRole("button", { name: "Manage MCP keys" }).click();
    await page.getByLabel("Agent name", { exact: true }).fill("Coding agent");
    await page.getByRole("button", { name: "Create key", exact: true }).click();
    const secret = await page.locator("#mcp-secret").inputValue();
    expect(secret).toMatch(/^rtx_[a-f0-9]{64}$/);
    await page.screenshot({
      path: "artifacts/mcp-key-dialog.png",
      mask: [page.locator("#mcp-secret")],
    });
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({
        colorScheme: width === 390 ? "dark" : "light",
      });
      await expect
        .poll(() =>
          page
            .getByRole("dialog")
            .evaluate((element) => getComputedStyle(element).backgroundColor),
        )
        .toBe(width === 390 ? "rgb(16, 16, 16)" : "rgb(255, 255, 255)");
      const box = await page.getByRole("dialog").boundingBox();
      if (!box) throw Error("Missing key dialog bounds");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      await page.screenshot({
        path: `artifacts/mcp-key-dialog-${width}.png`,
        mask: [page.locator("#mcp-secret")],
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    const endpoint = `${baseURL}/api/mcp`;
    const cross = await request.post(endpoint, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Origin: "https://untrusted.example",
      },
      data: {},
    });
    expect(cross.status()).toBe(403);
    const oversized = await request.post(endpoint, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: "x".repeat(512001),
    });
    expect(oversized.status()).toBe(413);
    const batch = await request.post(endpoint, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      data: [1, 2].map((id) => ({ jsonrpc: "2.0", id, method: "tools/list" })),
    });
    expect(batch.status()).toBe(400);
    expect((await batch.json()).error).toBe("Send one MCP message per request");
    const client = new Client({ name: "personal-agent", version: "1" });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${secret}` } },
      }),
    );
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
      "write_document",
    );
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      const value: unknown = JSON.parse(
        textResult.parse(result).content[0].text,
      );
      return value;
    };
    const layouts = z
      .array(z.object({ id: z.string(), source: z.string() }))
      .parse(await call("list_templates"));
    expect(layouts.map((layout) => layout.id)).toContain("jake");
    const tailored = resumeSchema.parse(
      await call("create_document", {
        template: "jake",
        name: `${job.company} resume`,
      }),
    );
    expect(
      z
        .array(resumeSchema.omit({ source: true }))
        .parse(await call("list_documents"))
        .map((doc) => doc.id),
    ).toContain(tailored.id);
    const initial = resumeSchema.parse(
      await call("read_document", { id: tailored.id }),
    );
    const replacement = initial.source.replace(
      "\\section{Experience}\n\\mbox{}",
      `\\section{Experience}\n${job.verifiedCandidateExperience}`,
    );
    const replaced = resumeSchema.parse(
      await call("write_document", {
        id: initial.id,
        baseDigest: initial.digest,
        expectedRevision: initial.revision,
        source: replacement,
        engine: initial.engine,
      }),
    );
    const patch = {
      id: replaced.id,
      baseDigest: replaced.digest,
      expectedRevision: replaced.revision,
      edits: [
        {
          expected: "\\section{Skills}\n\\mbox{}",
          replacement: `\\section{Skills}\n${job.keywords.join(", ")}.`,
        },
      ],
    };
    const patched = resumeSchema.parse(await call("patch_document", patch));
    expect(
      (await client.callTool({ name: "patch_document", arguments: patch }))
        .isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: "patch_document",
          arguments: {
            ...patch,
            baseDigest: patched.digest,
            expectedRevision: patched.revision,
            edits: [{ expected: "\\section", replacement: "invalid" }],
          },
        })
      ).isError,
    ).toBe(true);
    const invalid = resumeSchema.parse(
      await call("write_document", {
        id: patched.id,
        baseDigest: patched.digest,
        expectedRevision: patched.revision,
        engine: patched.engine,
        source: patched.source.replace(
          "\\end{document}",
          "\\undefinedfixturecommand\n\\end{document}",
        ),
      }),
    );
    const failed = z
      .object({
        ok: z.literal(false),
        log: z.string().min(1),
        diagnostics: z.array(z.object({ severity: z.string() })),
      })
      .parse(await call("compile_pdf", { id: invalid.id }));
    expect(failed.diagnostics.some((item) => item.severity === "error")).toBe(
      true,
    );
    await call("write_document", {
      id: invalid.id,
      baseDigest: invalid.digest,
      expectedRevision: invalid.revision,
      engine: invalid.engine,
      source: patched.source,
    });
    const finished = z
      .object({ ok: z.literal(true), uri: z.string(), log: z.string().min(1) })
      .parse(await call("compile_pdf", { id: patched.id }));
    const returned = z
      .object({
        contents: z.array(
          z.object({
            mimeType: z.literal("application/pdf"),
            blob: z.string(),
          }),
        ),
      })
      .parse(await client.readResource({ uri: finished.uri }));
    const tailoredBytes = Buffer.from(returned.contents[0].blob, "base64");
    expect(tailoredBytes.subarray(0, 5).toString()).toBe("%PDF-");
    const tailoredText = (await extractPdf(tailoredBytes)).text;
    for (const keyword of job.keywords) expect(tailoredText).toContain(keyword);
    await writeFile("artifacts/mcp-job-tailored.pdf", tailoredBytes);
    const current = resumeSchema.parse(
      JSON.parse(
        textResult.parse(
          await client.callTool({
            name: "read_document",
            arguments: { id: doc.id },
          }),
        ).content[0].text,
      ),
    );
    const args = {
      id: doc.id,
      baseDigest: current.digest,
      expectedRevision: current.revision,
      source: current.source.replace(
        "\\begin{document}",
        "\\begin{document}\nAgent verified content.",
      ),
      engine: current.engine,
    };
    expect(
      (await client.callTool({ name: "write_document", arguments: args }))
        .isError,
    ).not.toBe(true);
    expect(
      (await client.callTool({ name: "write_document", arguments: args }))
        .isError,
    ).toBe(true);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "LaTeX source" }),
    ).toContainText("Agent verified content.", { timeout: 25000 });
    await expect(page.locator(".textLayer")).toContainText(
      "Agent verified content.",
    );
    const exported = z
      .object({
        content: z.array(
          z.object({
            type: z.literal("resource"),
            resource: z.object({ text: z.string() }),
          }),
        ),
      })
      .parse(
        await client.callTool({
          name: "export_source",
          arguments: { id: doc.id },
        }),
      );
    expect(exported.content[0].resource.text).toBe(args.source);
    const compilation = z
      .object({ ok: z.literal(true), uri: z.string(), revision: z.number() })
      .parse(
        JSON.parse(
          textResult.parse(
            await client.callTool({
              name: "compile_pdf",
              arguments: { id: doc.id },
            }),
          ).content[0].text,
        ),
      );
    const resource = z
      .object({
        contents: z.array(
          z.object({
            mimeType: z.literal("application/pdf"),
            blob: z.string(),
          }),
        ),
      })
      .parse(await client.readResource({ uri: compilation.uri }));
    const bytes = Buffer.from(resource.contents[0].blob, "base64");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    await writeFile("artifacts/mcp-export.pdf", bytes);
    // The stdio bridge receives only its endpoint/key, with no Clerk or provider credentials.
    const stdio = new Client({ name: "stdio-test", version: "1" });
    clients.push(stdio);
    await stdio.connect(
      new StdioClientTransport({
        command: "bun",
        args: ["scripts/mcp.ts"],
        env: {
          PATH: process.env.PATH ?? "/usr/bin",
          MCP_URL: endpoint,
          MCP_API_KEY: secret,
        },
        stderr: "pipe",
      }),
    );
    expect((await stdio.listTools()).tools.map((tool) => tool.name)).toContain(
      "export_source",
    );
    const source = page.getByRole("textbox", { name: "LaTeX source" });
    const head = resumeSchema.parse(
      JSON.parse(
        textResult.parse(
          await client.callTool({
            name: "read_document",
            arguments: { id: doc.id },
          }),
        ).content[0].text,
      ),
    );
    conflictStage = true;
    await source.fill(head.source + "\n% local unsaved draft");
    expect(
      (
        await client.callTool({
          name: "write_document",
          arguments: {
            id: doc.id,
            baseDigest: head.digest,
            expectedRevision: head.revision,
            source: head.source + "\n% remote edit",
            engine: head.engine,
          },
        })
      ).isError,
    ).not.toBe(true);
    await expect(page.locator(".draft-conflict")).toContainText(
      "Your draft is preserved",
      { timeout: 25000 },
    );
    await expect(source).toContainText("local unsaved draft");
    expect(expected).toContain("stale manual save 409");
    conflictStage = false;
    await page
      .getByRole("button", {
        name: "Discard draft and load saved",
        exact: true,
      })
      .click();
    await expect(source).toContainText("remote edit");
    const jwt = await page.evaluate(async () =>
      window.Clerk.session?.getToken({ template: "convex" }),
    );
    if (!jwt || !process.env.NEXT_PUBLIC_CONVEX_URL)
      throw Error("Missing test owner token");
    const ownerClient = new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL,
    );
    ownerClient.setAuth(jwt);
    const shortSecret = `rtx_${randomBytes(32).toString("hex")}`;
    const expiresAt = Date.now() + 3500;
    const shortKey = z.object({ id: z.string() }).parse(
      await ownerClient.mutation(
        makeFunctionReference<"mutation">("workspace:issueKey"),
        {
          payload: JSON.stringify({
            label: "Expiry probe",
            keyHash: createHash("sha256").update(shortSecret).digest("hex"),
            prefix: shortSecret.slice(0, 12),
            expiresAt,
          }),
        },
      ),
    );
    const expiring = new Client({ name: "expiry-probe", version: "1" });
    clients.push(expiring);
    await expiring.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${shortSecret}` } },
      }),
    );
    await expiring.listTools();
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt - Date.now() + 50)),
    );
    expect(
      (
        await request.post(endpoint, {
          headers: { Authorization: `Bearer ${shortSecret}` },
          data: {},
        })
      ).status(),
    ).toBe(401);
    await expect(
      expiring.readResource({ uri: compilation.uri }),
    ).rejects.toThrow();
    await ownerClient.mutation(
      makeFunctionReference<"mutation">("workspace:revokeKey"),
      { id: shortKey.id },
    );
    await page.getByRole("button", { name: "Manage MCP keys" }).click();
    await expect(page.locator("#mcp-secret")).toHaveCount(0);
    await expect(page.getByText("Coding agent", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Revoke Coding agent", exact: true })
      .click();
    await expect(
      page.getByText("No connected agents.", { exact: false }),
    ).toBeVisible();
    await expect(
      client.readResource({ uri: compilation.uri }),
    ).rejects.toThrow();
    await expect(client.listTools()).rejects.toThrow();
    const cookieOnly = await page.request.post("/api/mcp", { data: {} });
    expect(cookieOnly.status()).toBe(401);
    await page.screenshot({ path: "artifacts/mcp-revoked.png" });
    expect(diagnostics).toEqual([]);
  } finally {
    for (const client of clients) await client.close();
    await cleanup(page);
    await writeFile(
      "artifacts/mcp-diagnostics.json",
      JSON.stringify({ unexpected: diagnostics, expected }, null, 2),
    );
  }
});
