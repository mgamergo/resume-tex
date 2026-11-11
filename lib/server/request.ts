import { auth } from "@clerk/nextjs/server";
import { DomainError } from "../core/model";
import { getStore } from "./store";
const rates = new Map<string, { count: number; until: number }>();
export async function scope(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new DomainError("Cross-origin request denied", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 512_000)
    throw new DomainError("Request exceeds 512 KB", 413);
  let owner: string;
  let token: string | undefined;
  if (process.env.APP_MODE === "local") {
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(request.url).hostname,
      )
    )
      throw new DomainError("Local workspace only accepts loopback hosts", 403);
    owner = "local-workspace";
  } else {
    if (process.env.APP_MODE !== "connected")
      throw new DomainError(
        "Configure APP_MODE=local or connected. See README.",
        503,
      );
    const session = await auth();
    if (!session.userId)
      throw new DomainError("Sign in to access your resumes", 401);
    owner = session.userId;
    token = (await session.getToken({ template: "convex" })) ?? undefined;
    if (!token)
      throw new DomainError("Clerk Convex JWT template is missing", 503);
  }
  const now = Date.now();
  const key = owner;
  const previous = rates.get(key);
  const rate =
    previous && previous.until > now
      ? previous
      : { count: 0, until: now + 60_000 };
  rate.count++;
  rates.set(key, rate);
  if (rates.size > 10_000)
    for (const [id, value] of rates) if (value.until < now) rates.delete(id);
  if (rate.count > 120)
    throw new DomainError("Too many requests. Try again in a minute.", 429);
  return { owner, store: getStore(owner, token) };
}
export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("Request body is missing");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000) {
        await reader.cancel();
        throw new DomainError("Request exceeds 512 KB", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DomainError("Invalid JSON");
  }
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json({ error: "Invalid request fields" }, { status: 400 });
  console.error(
    JSON.stringify({
      event: "request_error",
      message: error instanceof Error ? error.message : "Unknown failure",
    }),
  );
  return Response.json(
    { error: "The operation failed. Check server configuration and logs." },
    { status: 500 },
  );
}
