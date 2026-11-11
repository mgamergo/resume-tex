import { z } from "zod";
import { scope, readJson, failure } from "@/lib/server/request";
import { readArtifact, compile } from "@/lib/server/compiler";
import { extractPdf } from "@/lib/server/pdf-text";
import { analyzePdf } from "@/lib/core/ats";
import { DomainError } from "@/lib/core/model";
export async function POST(request: Request) {
  try {
    const { owner, store } = await scope(request);
    const { id, jobDescription } = z
      .object({ id: z.string(), jobDescription: z.string().max(20_000) })
      .parse(await readJson(request));
    const resume = await store.get(id);
    const result = await compile(owner, resume.source, resume.engine);
    if (!result.ok)
      throw new DomainError(
        "Compile your resume successfully before running ATS analysis.",
        422,
      );
    const pdf = await extractPdf(await readArtifact(owner, result.artifact));
    return Response.json(
      analyzePdf(
        pdf,
        resume.source,
        jobDescription,
        resume.digest,
        result.artifact,
        { engine: resume.engine, revision: resume.revision },
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
