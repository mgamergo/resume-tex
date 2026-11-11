import { scope, failure } from "@/lib/server/request";
import { readArtifact } from "@/lib/server/compiler";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { owner } = await scope(request);
    const { id } = await params;
    const data = await readArtifact(owner, id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename=resume.pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
