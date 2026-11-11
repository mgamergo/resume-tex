import { z } from "zod";
import { compile } from "@/lib/server/compiler";
import { scope, readJson, failure } from "@/lib/server/request";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { owner, store } = await scope(request);
    const { id } = z.object({ id: z.string() }).parse(await readJson(request));
    const resume = await store.get(id);
    return Response.json({
      ...(await compile(owner, resume.source, resume.engine)),
      engine: resume.engine,
      revision: resume.revision,
    });
  } catch (error) {
    return failure(error);
  }
}
