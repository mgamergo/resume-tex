import { DomainError } from "@/lib/core/model";
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
    const resume = await store.get(input.id);
    if (input.baseDigest !== resume.digest)
      throw new DomainError(
        "Document changed. Reload before requesting an edit.",
        409,
      );
    const assistant = provider();
    const call =
      input.call ?? (await assistant.plan(resume, input.instruction, input));
    return Response.json({
      ...(await executeTool(
        store,
        input.id,
        call,
        resume.digest,
        input.call ? input.verifiedEvidence : undefined,
      )),
      provider: assistant.label,
    });
  } catch (error) {
    return failure(error);
  }
}
