import express from "express";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// 1) Create the MCP server
const server = new McpServer({
  name: "openphone-bridge",
  version: "1.0.0",
});

// 2) (Optional) Example tool to prove it works
server.tool(
  "echo",
  { text: z.string() },
  async ({ text }) => ({ content: [{ type: "text", text }] })
);

// 3) (Optional) Example resource
server.resource(
  "hello",
  new ResourceTemplate("hello://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{ uri: uri.href, text: `Hello, ${name}!` }]
  })
);

// Keep track of transports by session
const transports = new Map();

/**
 * SSE endpoint that Claude connects to.
 * Claude opens this first; we hand it an SSE stream and give it a URL
 * to POST messages back to (/messages?sessionId=...).
 */
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const id = transport.sessionId;

  transport.onclose = () => {
    transports.delete(id);
    console.log(`SSE closed: ${id}`);
  };

  transports.set(id, transport);
  console.log(`SSE open: ${id}`);
  await server.connect(transport);
});

/**
 * Messages endpoint: Claude POSTs its protocol messages here,
 * we route them to the correct transport by sessionId.
 */
app.post("/messages", async (req, res) => {
  const id = req.query.sessionId;
  if (!id) return res.status(400).json({ error: "Missing sessionId" });

  const transport = transports.get(id);
  if (!transport) return res.status(404).json({ error: "Unknown sessionId" });

  await transport.handlePostMessage(req, res);
});

// Healthcheck for Railway
app.get("/", (_req, res) => res.send("MCP server is running."));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on :${port}`));
