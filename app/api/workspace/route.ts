import { z } from "zod";
import { engineSchema, sourceSchema, DomainError } from "@/lib/core/model";
import { templates } from "@/lib/core/templates";
import { scope, readJson, failure } from "@/lib/server/request";
const command = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    template: z.string(),
    name: z.string().min(1).max(80),
  }),
  z.object({
    op: z.literal("save"),
    id: z.string(),
    baseDigest: z.string(),
    expectedRevision: z.number().int(),
    source: sourceSchema,
    engine: engineSchema,
    name: z.string().min(1).max(80).optional(),
  }),
  z.object({ op: z.literal("delete"), id: z.string() }),
  z.object({
    op: z.literal("restore"),
    id: z.string(),
    revision: z.number().int(),
    expectedRevision: z.number().int(),
    baseDigest: z.string(),
  }),
  z.object({
    op: z.literal("decide"),
    id: z.string(),
    proposalId: z.string(),
    accept: z.boolean(),
  }),
]);
export async function GET(request: Request) {
  try {
    const { store } = await scope(request);
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if (!id) return Response.json({ resumes: await store.list() });
    return Response.json({
      resume: await store.get(id),
      history: await store.history(id),
      proposals: await store.proposals(id),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { store } = await scope(request);
    const input = command.parse(await readJson(request));
    switch (input.op) {
      case "create": {
        const template = templates.find((t) => t.id === input.template);
        if (!template) throw new DomainError("Unknown template");
        return Response.json({
          resume: await store.create({
            name: input.name,
            source: template.source,
            engine: template.engine,
            template: template.id,
          }),
        });
      }
      case "save":
        return Response.json({ resume: await store.save(input) });
      case "delete":
        await store.remove(input.id);
        return Response.json({ ok: true });
      case "decide":
        return Response.json({
          resume: await store.decide(input.id, input.proposalId, input.accept),
        });
      case "restore": {
        const revision = await store.revision(input.id, input.revision);
        if (!revision) throw new DomainError("Revision not found", 404);
        return Response.json({
          resume: await store.save({
            id: input.id,
            baseDigest: input.baseDigest,
            expectedRevision: input.expectedRevision,
            source: revision.source,
            engine: revision.engine,
            note: `Restored revision ${revision.revision}`,
          }),
        });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
