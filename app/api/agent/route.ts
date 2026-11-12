import { z } from "zod";
import { scope, readJson, failure } from "@/lib/server/request";
import { executeTool, toolCallSchema } from "@/lib/server/tools";
import { provider } from "@/lib/server/provider";
const inputSchema = z.object({
  id: z.string(),
  baseDigest: z.string().regex(/^[a-f0-9]{64}$/),
  instruction: z.string().max(4000).default(""),
  jobDescription: z.string().max(20_000).default(""),
  log: z.string().max(100_000).default(""),
  call: toolCallSchema.optional(),
  verifiedEvidence: z.string().max(2000).optional(),
});
export async function POST(request: Request) {
  try {
    const { store } = await scope(request);
    const input = inputSchema.parse(await readJson(request));
    const assistant = provider();
    const action = input.call
      ? {
          kind: "structured" as const,
          call: input.call,
          verifiedEvidence: input.verifiedEvidence ?? "",
        }
      : {
          kind: "planned" as const,
          resolve: (resume: Parameters<typeof assistant.plan>[0]) =>
            assistant.plan(resume, input.instruction, input),
        };
    return Response.json({
      ...(await executeTool(store, {
        kind: "edit",
        resumeId: input.id,
        baseDigest: input.baseDigest,
        action,
      })),
      provider: input.call ? "Structured edit tool" : assistant.label,
    });
  } catch (error) {
    return failure(error);
  }
}
