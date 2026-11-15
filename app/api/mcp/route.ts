import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getAgentStore } from "@/lib/server/agent-store";
import { createMcpServer } from "@/lib/server/mcp";
import { DomainError } from "@/lib/core/model";
import { failure, checkRate, readJson } from "@/lib/server/request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== process.env.APP_ORIGIN)
      throw new DomainError("Cross-origin request denied", 403);
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer rtx_[a-f0-9]{64}$/.test(authorization))
      throw new DomainError("MCP bearer key required", 401);
    const store = getAgentStore(authorization.slice(7));
    const { owner } = await store.authenticate();
    checkRate(owner, "mcp", 120);
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    const input = await readJson(request);
    if (Array.isArray(input))
      throw new DomainError("Send one MCP message per request", 400);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = createMcpServer(store);
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, {
        parsedBody: input,
      });
      // JSON mode has completed its handler before returning; consume before disposal.
      const body = await response.arrayBuffer();
      return new Response(body.byteLength ? body : null, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          "Cache-Control": "private, no-store",
        },
      });
    } finally {
      await server.close();
    }
  } catch (error) {
    const response = failure(error);
    response.headers.set("Cache-Control", "no-store");
    if (response.status === 401)
      response.headers.set("WWW-Authenticate", 'Bearer realm="resume-tex"');
    return response;
  }
}
export { handle as POST, handle as GET, handle as DELETE };
