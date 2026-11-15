import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
const url = new URL(process.env.MCP_URL ?? "http://localhost:3000/api/mcp");
const secret = process.env.MCP_API_KEY;
if (!secret || !/^rtx_[a-f0-9]{64}$/.test(secret))
  throw new Error("Set MCP_API_KEY to a key created in the app");
if (
  url.protocol !== "https:" &&
  !(
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
)
  throw new Error("Remote MCP requires HTTPS");
const client = new Client({ name: "resume-tex-stdio", version: "2.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${secret}` } },
  }),
);
const server = new Server(
  { name: "resume-tex", version: "2.0.0" },
  { capabilities: { tools: {}, resources: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, () => client.listTools());
server.setRequestHandler(CallToolRequestSchema, (request) =>
  client.callTool(request.params),
);
server.setRequestHandler(ListResourcesRequestSchema, () =>
  client.listResources(),
);
server.setRequestHandler(ListResourceTemplatesRequestSchema, () =>
  client.listResourceTemplates(),
);
server.setRequestHandler(ReadResourceRequestSchema, (request) =>
  client.readResource(request.params),
);
server.onclose = () => {
  void client.close();
};
await server.connect(new StdioServerTransport());
