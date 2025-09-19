import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const app = express();

/* ---------------- MCP server ---------------- */

const mcp = new Server(
  { name: "openphone-history-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Health check
mcp.addTool({
  name: "ping",
  description: "Simple health check",
  inputSchema: {
    type: "object",
    properties: { message: { type: "string" } },
    additionalProperties: false
  },
  execute: async ({ message }) => ({
    content: [{ type: "text", text: `pong${message ? `: ${message}` : ""}` }]
  })
});

// Echo
mcp.addTool({
  name: "echo",
  description: "Echo back arbitrary text",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false
  },
  execute: async ({ text }) => ({
    content: [{ type: "text", text }]
  })
});

/* --------------- HTTP transport --------------- */

function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// SSE handshake for Claude Connectors
app.get("/sse", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.write(`event: endpoint\n`);
  res.write(`data: ${baseUrl(req)}/messages\n\n`);
  req.on("close", () => { try { res.end(); } catch {} });
});

// SDK handles POST /messages
app.post("/messages", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    await mcp.handleHttp(req, res);
  } catch (e) {
    console.error("MCP HTTP handler error:", e);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`Listening on :${PORT}`));
