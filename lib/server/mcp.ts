import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveDocumentSchema } from "../core/mcp";
import { compile, readArtifact } from "./compiler";
import type { AgentStore } from "./agent-store";
import { checkRate } from "./request";
import { DomainError } from "../core/model";
export function createMcpServer(store: AgentStore) {
  const server = new McpServer({ name: "resume-tex", version: "2.0.0" });
  const idSchema = z.string().min(1).max(100);
  const text = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  });
  server.registerTool(
    "list_documents",
    { description: "List your saved LaTeX documents.", inputSchema: {} },
    async () => text(await store.list()),
  );
  server.registerTool(
    "read_document",
    {
      description:
        "Read saved source, engine, digest and revision. Read before writing.",
      inputSchema: { id: idSchema },
    },
    async ({ id }) => text(await store.get(id)),
  );
  server.registerTool(
    "write_document",
    {
      description:
        "Save LaTeX source atomically. Requires the digest AND revision from read_document. A conflict requires a fresh read; never blindly retry.",
      inputSchema: saveDocumentSchema.shape,
    },
    async (input) => text(await store.save(input)),
  );
  server.registerTool(
    "export_source",
    {
      description: "Export saved LaTeX as a text resource.",
      inputSchema: { id: idSchema },
    },
    async ({ id }) => {
      const doc = await store.get(id);
      return {
        content: [
          {
            type: "resource",
            resource: {
              uri: `resume-tex://source/${doc.id}/${doc.revision}`,
              mimeType: "application/x-tex",
              text: doc.source,
            },
          },
        ],
      };
    },
  );
  server.registerTool(
    "compile_pdf",
    {
      description:
        "Compile saved source in the isolated TeX sandbox. Returns diagnostics and an authenticated PDF resource URI. Read that URI with resources/read to obtain PDF bytes directly.",
      inputSchema: { id: idSchema },
    },
    async ({ id }) => {
      const { owner } = await store.authenticate();
      checkRate(owner, "compile", 60);
      const doc = await store.get(id);
      const result = await compile(owner, doc.source, doc.engine);
      return text({
        ...result,
        engine: doc.engine,
        revision: doc.revision,
        ...(result.ok
          ? {
              uri: `resume-tex://pdf/${doc.id}/${doc.revision}/${result.artifact}`,
            }
          : {}),
      });
    },
  );
  server.registerResource(
    "pdf",
    new ResourceTemplate("resume-tex://pdf/{id}/{revision}/{artifact}", {
      list: undefined,
    }),
    {
      mimeType: "application/pdf",
      description:
        "Compiled PDF bytes. Requires an active MCP key; cache eviction requires recompilation.",
    },
    async (uri, variables) => {
      const { owner } = await store.authenticate();
      const id = idSchema.parse(variables.id);
      const revision = z.coerce
        .number()
        .int()
        .positive()
        .parse(variables.revision);
      const artifact = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(variables.artifact);
      const doc = await store.revision(id, revision);
      // Verify this resource names the requested immutable revision, without compiling.
      const data = await readArtifact(owner, artifact, {
        source: doc.source,
        engine: doc.engine,
      });
      if (data.length > 10_485_760)
        throw new DomainError("PDF exceeds the resource size limit", 413);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/pdf",
            blob: data.toString("base64"),
          },
        ],
      };
    },
  );
  return server;
}
