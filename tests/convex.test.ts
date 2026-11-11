import { describe, it, expect } from "vitest";
import { defineTestApp } from "convex-test";
import schema from "../convex/schema";
import * as workspace from "../convex/workspace";
import { templates } from "../lib/core/templates";
import { mapConvexError } from "../lib/server/convex-errors";
import { resumeSchema, proposalSchema } from "../lib/core/schemas";
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
    const proposal = proposalSchema.parse(
      await owner.mutation(app.api.workspace.write, {
        op: "propose",
        payload: JSON.stringify({ id: doc.id, input }),
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
          id: doc.id,
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
