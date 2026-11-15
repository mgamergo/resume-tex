import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { defineTestApp } from "convex-test";
import schema from "../convex/schema";
import * as workspace from "../convex/workspace";
import { templates } from "../lib/core/templates";
import { resumeSchema } from "../lib/core/schemas";
const app = defineTestApp({ schema }).defineModules({ workspace });
const secret = `rtx_${"ab".repeat(32)}`;
const keyHash = createHash("sha256").update(secret).digest("hex");
function fixture() {
  const t = app.createTest();
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  const create = async (who = owner) =>
    resumeSchema.parse(
      await who.mutation(app.api.workspace.write, {
        op: "create",
        payload: JSON.stringify({
          name: "Cloud",
          source: templates[0].source,
          engine: templates[0].engine,
          template: templates[0].id,
        }),
      }),
    );
  const issue = async () =>
    owner.mutation(app.api.workspace.issueKey, {
      payload: JSON.stringify({
        label: "Agent",
        keyHash,
        prefix: secret.slice(0, 12),
        expiresAt: Date.now() + 86400000,
      }),
    });
  const read = (op: string, payload: object = {}, apiKey = secret) =>
    t.mutation(app.api.workspace.agentRead, {
      apiKey,
      op,
      payload: JSON.stringify(payload),
    });
  return { t, owner, other, create, issue, read };
}
beforeEach(() => vi.stubEnv("MCP_OWNER_CLERK_ID", "owner"));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("manual source and agent authorization", () => {
  it("rejects anonymous and cross-tenant reads and preserves immutable history with revision CAS", async () => {
    const { t, owner, other, create } = fixture();
    await expect(
      t.query(app.api.workspace.read, { op: "list", payload: "{}" }),
    ).rejects.toThrow("Authentication required");
    const doc = await create();
    await expect(
      other.query(app.api.workspace.read, {
        op: "get",
        payload: JSON.stringify({ id: doc.id }),
      }),
    ).rejects.toThrow("Resume not found");
    const input = {
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      source: doc.source,
      engine: doc.engine,
      name: "Renamed",
    };
    const next = resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "save",
        payload: JSON.stringify(input),
      }),
    );
    await expect(
      owner.mutation(app.api.workspace.write, {
        op: "save",
        payload: JSON.stringify(input),
      }),
    ).rejects.toThrow("Revision conflict");
    expect(next.revision).toBe(2);
    expect(
      await owner.query(app.api.workspace.read, {
        op: "revision",
        payload: JSON.stringify({ id: doc.id, revision: 1 }),
      }),
    ).toEqual({ ...doc, note: "Created from template" });
    await expect(
      owner.mutation(app.api.workspace.write, { op: "propose", payload: "{}" }),
    ).rejects.toThrow();
  });
  it("only the configured owner can issue keys; missing owner disables MCP", async () => {
    const { t, other, issue } = fixture();
    await expect(t.query(app.api.workspace.keys, {})).rejects.toThrow(
      "Authentication required",
    );
    await expect(
      other.mutation(app.api.workspace.issueKey, { payload: "{}" }),
    ).rejects.toThrow("restricted");
    vi.stubEnv("MCP_OWNER_CLERK_ID", "");
    await expect(issue()).rejects.toThrow("restricted");
  });
  it("stores only the key hash and never accepts the stored hash as a credential", async () => {
    const { t, owner, issue, read } = fixture();
    await issue();
    expect(await read("authenticate")).toEqual({ owner: "owner" });
    await expect(read("list", {}, keyHash)).rejects.toThrow(
      "Invalid or expired",
    );
    await expect(read("list", {}, `rtx_${"cd".repeat(32)}`)).rejects.toThrow(
      "Invalid or expired",
    );
    const keys = await owner.query(app.api.workspace.keys, {});
    expect(JSON.stringify(keys)).not.toContain(keyHash);
    expect(JSON.stringify(keys)).not.toContain(secret);
    const stored = await t.run((ctx) => ctx.db.query("mcpKeys").collect());
    expect(stored[0].keyHash).toBe(keyHash);
    expect(JSON.stringify(stored)).not.toContain(secret);
  });
  it("agents can read and save only owner's documents, with atomic stale-write rejection", async () => {
    const { t, create, other, issue, read } = fixture();
    const doc = await create();
    const foreign = await create(other);
    await issue();
    expect(resumeSchema.parse(await read("get", { id: doc.id }))).toEqual(doc);
    await expect(read("get", { id: foreign.id })).rejects.toThrow(
      "Resume not found",
    );
    const payload = JSON.stringify({
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      source: "% Agent\n" + doc.source,
      engine: doc.engine,
    });
    const next = resumeSchema.parse(
      await t.mutation(app.api.workspace.agentWrite, {
        apiKey: secret,
        payload,
      }),
    );
    expect(next.revision).toBe(2);
    expect(next.source).toContain("% Agent");
    await expect(
      t.mutation(app.api.workspace.agentWrite, { apiKey: secret, payload }),
    ).rejects.toThrow("Revision conflict");
    const foreignPayload = JSON.stringify({
      id: foreign.id,
      baseDigest: foreign.digest,
      expectedRevision: foreign.revision,
      source: foreign.source,
      engine: foreign.engine,
    });
    await expect(
      t.mutation(app.api.workspace.agentWrite, {
        apiKey: secret,
        payload: foreignPayload,
      }),
    ).rejects.toThrow("Resume not found");
    await expect(read("details", { id: doc.id })).rejects.toThrow(
      "Unknown agent operation",
    );
  });
  it("revocation and expiry stop reads AND writes; account allowlist changes stop issued keys", async () => {
    const { t, owner, other, create, issue, read } = fixture();
    const doc = await create();
    const key = await issue();
    const payload = JSON.stringify({
      id: doc.id,
      baseDigest: doc.digest,
      expectedRevision: doc.revision,
      source: doc.source,
      engine: doc.engine,
    });
    await expect(
      other.mutation(app.api.workspace.revokeKey, { id: key.id }),
    ).rejects.toThrow("restricted");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 86400000);
    await expect(read("list")).rejects.toThrow("Invalid or expired");
    await expect(
      t.mutation(app.api.workspace.agentWrite, { apiKey: secret, payload }),
    ).rejects.toThrow("Invalid or expired");
    vi.useRealTimers();
    await owner.mutation(app.api.workspace.revokeKey, { id: key.id });
    await issue();
    vi.stubEnv("MCP_OWNER_CLERK_ID", "other");
    await expect(read("list")).rejects.toThrow("Invalid or expired");
    vi.stubEnv("MCP_OWNER_CLERK_ID", "owner");
    const [active] = await owner.query(app.api.workspace.keys, {});
    await owner.mutation(app.api.workspace.revokeKey, { id: active.id });
    await expect(read("get", { id: doc.id })).rejects.toThrow(
      "Invalid or expired",
    );
    await expect(
      t.mutation(app.api.workspace.agentWrite, { apiKey: secret, payload }),
    ).rejects.toThrow("Invalid or expired");
  });
});
