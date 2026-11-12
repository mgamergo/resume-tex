import { z } from "zod";
import {
  agentEditPolicySchema,
  editContextSchema,
  workspaceDetailsSchema,
  type AgentEditPolicy,
} from "../lib/core/agent-policy";
import { describe, it, expect } from "vitest";
import { defineTestApp } from "convex-test";
import schema from "../convex/schema";
import * as workspace from "../convex/workspace";
import { templates } from "../lib/core/templates";
import { mapConvexError } from "../lib/server/convex-errors";
import { resumeSchema } from "../lib/core/schemas";
import { submissionResultSchema } from "../lib/core/agent-policy";
const app = defineTestApp({ schema }).defineModules({ workspace });
describe("Convex authenticated storage", () => {
  it("rejects anonymous and cross-tenant access and atomically enforces metadata CAS + stale review", async () => {
    const t = app.createTest();
    const owner = t.withIdentity({ subject: "owner" });
    const other = t.withIdentity({ subject: "other" });
    await expect(
      t.query(app.api.workspace.read, { op: "list", payload: "{}" }),
    ).rejects.toThrow("Authentication required");
    const template = templates[0];
    const doc = resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "create",
        payload: JSON.stringify({
          name: "Cloud",
          source: template.source,
          engine: template.engine,
          template: template.id,
        }),
      }),
    );
    await expect(
      other.query(app.api.workspace.read, {
        op: "get",
        payload: JSON.stringify({ id: doc.id }),
      }),
    ).rejects.toThrow("Resume not found");
    const payload = {
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
        payload: JSON.stringify(payload),
      }),
    );
    await expect(
      owner.mutation(app.api.workspace.write, {
        op: "save",
        payload: JSON.stringify({ ...payload, name: "Concurrent" }),
      }),
    ).rejects.toThrow("Revision conflict");
    const input = {
      baseDigest: next.digest,
      title: "Comment",
      explanation: "A bounded exact comment",
      edits: [{ start: 0, end: 0, expected: "", replacement: "% reviewed\n" }],
      evidenceNeeded: [],
    };
    const { proposal } = submissionResultSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "propose",
        payload: JSON.stringify({
          resumeId: doc.id,
          input,
          expectedRevision: next.revision,
          policyVersion: 0,
        }),
      }),
    );
    await expect(
      other.mutation(app.api.workspace.write, {
        op: "decide",
        payload: JSON.stringify({
          id: doc.id,
          proposalId: proposal.id,
          accept: true,
        }),
      }),
    ).rejects.toThrow("Resume not found");
    expect(
      resumeSchema.parse(
        await owner.query(app.api.workspace.read, {
          op: "get",
          payload: JSON.stringify({ id: doc.id }),
        }),
      ),
    ).toEqual(next);
    const newer = resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "save",
        payload: JSON.stringify({
          ...payload,
          expectedRevision: next.revision,
          source: next.source + "\n",
        }),
      }),
    );
    await expect(
      owner.mutation(app.api.workspace.write, {
        op: "decide",
        payload: JSON.stringify({
          id: doc.id,
          proposalId: proposal.id,
          accept: true,
        }),
      }),
    ).rejects.toThrow("Stale proposal");
    expect(newer.revision).toBe(3);
  });
  it("invalid exact edits retain actionable conflict semantics across the Convex boundary", async () => {
    const owner = app.createTest().withIdentity({ subject: "edit-owner" });
    const template = templates[0];
    const doc = resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "create",
        payload: JSON.stringify({
          name: "Conflict",
          source: template.source,
          engine: template.engine,
          template: template.id,
        }),
      }),
    );
    let failure: unknown;
    try {
      await owner.mutation(app.api.workspace.write, {
        op: "propose",
        payload: JSON.stringify({
          resumeId: doc.id,
          expectedRevision: doc.revision,
          policyVersion: 0,
          input: {
            baseDigest: doc.digest,
            title: "Exact edit",
            explanation: "",
            evidenceNeeded: [],
            edits: [{ start: 0, end: 1, expected: "wrong", replacement: "x" }],
          },
        }),
      });
    } catch (error) {
      failure = error;
    }
    const mapped = mapConvexError(failure);
    expect(mapped?.status).toBe(409);
    expect(mapped?.message).toContain("range no longer matches");
  });
  it("bounds history and lists only resumes independently of full-source version count", async () => {
    const t = app.createTest();
    const owner = t.withIdentity({ subject: "history-owner" });
    const template = templates[0];
    let doc = resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "create",
        payload: JSON.stringify({
          name: "History",
          source: template.source,
          engine: template.engine,
          template: template.id,
        }),
      }),
    );
    for (let index = 0; index < 105; index++)
      doc = resumeSchema.parse(
        await owner.mutation(app.api.workspace.write, {
          op: "save",
          payload: JSON.stringify({
            id: doc.id,
            baseDigest: doc.digest,
            expectedRevision: doc.revision,
            source: doc.source,
            engine: doc.engine,
          }),
        }),
      );
    const list = await owner.query(app.api.workspace.read, {
      op: "list",
      payload: "{}",
    });
    expect(list).toHaveLength(1);
    const history = await owner.query(app.api.workspace.read, {
      op: "history",
      payload: JSON.stringify({ id: doc.id }),
    });
    expect(history).toHaveLength(100);
  });
});

describe("Resume-scoped agent autonomy", () => {
  function session() {
    const t = app.createTest();
    return {
      t,
      owner: t.withIdentity({ subject: "policy-owner" }),
      other: t.withIdentity({ subject: "policy-other" }),
    };
  }
  type Owner = ReturnType<typeof session>["owner"];
  async function document(owner: Owner) {
    const template = templates[0];
    return resumeSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "create",
        payload: JSON.stringify({
          name: "Autonomy",
          source: template.source,
          engine: template.engine,
          template: template.id,
        }),
      }),
    );
  }
  async function context(owner: Owner, id: string) {
    return editContextSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "edit_context",
        payload: JSON.stringify({ id }),
      }),
    );
  }
  async function mode(
    owner: Owner,
    id: string,
    value: AgentEditPolicy["mode"],
    version: number,
  ) {
    return agentEditPolicySchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "agent_policy",
        payload: JSON.stringify({
          resumeId: id,
          mode: value,
          expectedVersion: version,
        }),
      }),
    );
  }
  function command(
    snapshot: z.infer<typeof editContextSchema>,
    evidenceNeeded: string[] = [],
  ) {
    return {
      resumeId: snapshot.resume.id,
      expectedRevision: snapshot.resume.revision,
      policyVersion: snapshot.policy.version,
      input: {
        baseDigest: snapshot.resume.digest,
        title: "Targeted edit",
        explanation: "A source comment",
        edits: [
          { start: 0, end: 0, expected: "", replacement: "% agent edit\n" },
        ],
        evidenceNeeded,
      },
    };
  }
  async function submit(owner: Owner, input: ReturnType<typeof command>) {
    return submissionResultSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "propose",
        payload: JSON.stringify(input),
      }),
    );
  }
  it("defaults old resumes to review and isolates policy writes with independent CAS", async () => {
    const { owner, other, t } = session();
    const doc = await document(owner);
    expect((await context(owner, doc.id)).policy).toEqual({
      mode: "review",
      version: 0,
    });
    expect(await mode(owner, doc.id, "autonomous", 0)).toEqual({
      mode: "autonomous",
      version: 1,
    });
    expect(await mode(owner, doc.id, "autonomous", 1)).toEqual({
      mode: "autonomous",
      version: 1,
    });
    await expect(mode(owner, doc.id, "review", 0)).rejects.toThrow(
      "Agent permission changed",
    );
    await expect(mode(other, doc.id, "autonomous", 0)).rejects.toThrow(
      "Resume not found",
    );
    await expect(
      t.query(app.api.workspace.read, {
        op: "edit_context",
        payload: JSON.stringify({ id: doc.id }),
      }),
    ).rejects.toThrow("Authentication required");
    const details = workspaceDetailsSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "details",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(details.resume).toEqual(doc);
    expect(details.history).toHaveLength(1);
    expect(details.policy.version).toBe(1);
  });
  it("queues review edits and atomically commits source, accepted proposal and history under autonomy", async () => {
    const { owner } = session();
    const doc = await document(owner);
    const pending = await submit(owner, command(await context(owner, doc.id)));
    expect(pending.kind).toBe("proposal");
    expect((await context(owner, doc.id)).resume.revision).toBe(1);
    await mode(owner, doc.id, "autonomous", 0);
    const before = workspaceDetailsSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "details",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(before.proposals[0].status).toBe("pending");
    expect(before.resume).toEqual(doc);
    const applied = await submit(owner, command(await context(owner, doc.id)));
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied")
      throw new Error("Expected accepted revision");
    expect(applied.resume.source).toBe("% agent edit\n" + doc.source);
    expect(applied.resume.revision).toBe(2);
    const details = workspaceDetailsSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "details",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(details.history).toHaveLength(2);
    expect(details.history[0].note).toBe("Accepted: Targeted edit");
    expect(
      details.proposals.find((p) => p.id === applied.proposal.id)?.status,
    ).toBe("accepted");
    expect(
      details.proposals.find((p) => p.id === pending.proposal.id)?.status,
    ).toBe("pending");
  });
  it("does not upgrade requests across disable, disable/re-enable or review-to-autonomous changes", async () => {
    for (const transition of ["disable", "regrant", "enable"]) {
      const { owner } = session();
      const doc = await document(owner);
      if (transition !== "enable") await mode(owner, doc.id, "autonomous", 0);
      const captured = await context(owner, doc.id);
      if (transition === "enable") await mode(owner, doc.id, "autonomous", 0);
      else {
        await mode(owner, doc.id, "review", 1);
        if (transition === "regrant")
          await mode(owner, doc.id, "autonomous", 2);
      }
      expect((await submit(owner, command(captured))).kind).toBe("proposal");
      expect((await context(owner, doc.id)).resume).toEqual(doc);
    }
  });
  it("rejects stale revisions even when the source digest matches", async () => {
    const { owner } = session();
    const doc = await document(owner);
    await mode(owner, doc.id, "autonomous", 0);
    const captured = await context(owner, doc.id);
    await owner.mutation(app.api.workspace.write, {
      op: "save",
      payload: JSON.stringify({
        id: doc.id,
        source: doc.source,
        engine: doc.engine,
        baseDigest: doc.digest,
        expectedRevision: 1,
        name: "Renamed",
      }),
    });
    await expect(submit(owner, command(captured))).rejects.toThrow(
      "Stale proposal",
    );
    const details = workspaceDetailsSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "details",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(details.proposals).toHaveLength(0);
    expect(details.resume.revision).toBe(2);
  });
  it("allows only one same-base autonomous submission to commit", async () => {
    const { owner } = session();
    const doc = await document(owner);
    await mode(owner, doc.id, "autonomous", 0);
    const captured = await context(owner, doc.id);
    const results = await Promise.allSettled([
      submit(owner, command(captured)),
      submit(owner, command(captured)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const details = workspaceDetailsSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "details",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(details.proposals).toHaveLength(1);
    expect(details.resume.revision).toBe(2);
    expect(details.history).toHaveLength(2);
  });
  it("keeps evidence-blocked edits pending and prevents explicit acceptance from bypassing evidence", async () => {
    const { owner } = session();
    const doc = await document(owner);
    await mode(owner, doc.id, "autonomous", 0);
    const result = await submit(
      owner,
      command(await context(owner, doc.id), ["Author evidence required"]),
    );
    expect(result.kind).toBe("proposal");
    await expect(
      owner.mutation(app.api.workspace.write, {
        op: "decide",
        payload: JSON.stringify({
          id: doc.id,
          proposalId: result.proposal.id,
          accept: true,
        }),
      }),
    ).rejects.toThrow("evidence requirements");
    expect((await context(owner, doc.id)).resume).toEqual(doc);
  });
  it("fails closed for a malformed persisted permission", async () => {
    const { t, owner } = session();
    const doc = await document(owner);
    const captured = await context(owner, doc.id);
    await t.run(async (ctx) => {
      await ctx.db.insert("records", {
        owner: "policy-owner",
        kind: "agent-edit-policy",
        key: doc.id,
        resumeId: doc.id,
        body: JSON.stringify({ mode: "autonomous", version: -1 }),
      });
    });
    await expect(context(owner, doc.id)).rejects.toThrow();
    await expect(submit(owner, command(captured))).rejects.toThrow();
    const current = resumeSchema.parse(
      await owner.query(app.api.workspace.read, {
        op: "get",
        payload: JSON.stringify({ id: doc.id }),
      }),
    );
    expect(current).toEqual(doc);
  });
  it("rolls back invalid edits and never restores permission from content history", async () => {
    const { owner } = session();
    const doc = await document(owner);
    await mode(owner, doc.id, "autonomous", 0);
    const invalid = command(await context(owner, doc.id));
    invalid.input.edits[0] = {
      start: 0,
      end: 1,
      expected: "wrong",
      replacement: "x",
    };
    await expect(submit(owner, invalid)).rejects.toThrow(
      "range no longer matches",
    );
    expect((await context(owner, doc.id)).resume).toEqual(doc);
    const result = await submit(owner, command(await context(owner, doc.id)));
    if (result.kind !== "applied") throw new Error("Expected application");
    await mode(owner, doc.id, "review", 1);
    await owner.mutation(app.api.workspace.write, {
      op: "save",
      payload: JSON.stringify({
        id: doc.id,
        source: doc.source,
        engine: doc.engine,
        baseDigest: result.resume.digest,
        expectedRevision: result.resume.revision,
        note: "Restore original source",
      }),
    });
    expect((await context(owner, doc.id)).policy).toEqual({
      mode: "review",
      version: 2,
    });
  });
});
