import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { verifyToken } from "@clerk/nextjs/server";
import { z } from "zod";
import { getStore } from "../lib/server/store";
import {
  executeTool,
  toolCallSchema,
  toolDescriptions,
} from "../lib/server/tools";
const resumeId = z.string().min(1).parse(process.env.MCP_RESUME_ID);
let owner: string;
let token: string | undefined;
if (process.env.APP_MODE === "local") owner = "local-workspace";
else {
  token = process.env.MCP_CLERK_TOKEN;
  if (!token || !process.env.CLERK_SECRET_KEY)
    throw new Error(
      "Connected MCP requires a Clerk-issued Convex JWT and CLERK_SECRET_KEY from Infisical",
    );
  const identity = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    audience: "convex",
  });
  owner = identity.sub;
}
const store = getStore(owner, token);
await store.get(resumeId);
const server = new McpServer({ name: "resume-tex", version: "1.0.0" });
server.registerTool(
  "read_document",
  { description: toolDescriptions.read_document, inputSchema: {} },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await executeTool(store, resumeId, { tool: "read_document" }),
        ),
      },
    ],
  }),
);
server.registerTool(
  "propose_edit",
  {
    description:
      "Propose one validated structured edit for the selected resume. The UI must approve. No approval, arbitrary files, network, or shell tool is exposed.",
    inputSchema: {
      baseDigest: z.string().regex(/^[a-f0-9]{64}$/),
      call: toolCallSchema,
    },
  },
  async ({ call, baseDigest }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await executeTool(store, resumeId, call, baseDigest),
        ),
      },
    ],
  }),
);
await server.connect(new StdioServerTransport());
