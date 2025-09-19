import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * IMPORTANT
 * We do not enforce Authorization headers here so Claude can connect.
 * Keep this service private (random URL) or add a firewall if you need to restrict access.
 */

const app = express();

/** ---- MCP server + tools ---------------------------------------------- */

// Create an MCP server instance
const mcp = new Server(
  {
    name: "openphone-history-mcp",
    version: "1.0.0",
  },
  {
    // Capabilities we’ll claim. Expand as you add real tools/resources.
    capabilities: {
      tools: {},
    },
  }
);

// Example Tool 1: ping
mcp.tool("ping", "Simple health check", async ({ params }) => {
  return {
    content: [{ type: "text", text: `pong${params?.message ? `: ${params.message}` : ""}` }],
  };
});

// Example Tool 2: echo
mcp.tool("echo", "Echo back arbitrary text", async ({ params }) => {
  const text = typeof params?.text === "string" ? params.text : "";
  return { content: [{ type: "text", text }] };
});

/** ---- HTTP transport for Claude Connectors ----------------------------

Claude Connectors uses:
  1) GET /sse  -> Server-Sent Events; we must emit a single "endpoint" event
                 containing the absolute URL that Claude should POST messages to.
  2) POST /messages -> MCP JSON-RPC over HTTP handled by the SDK.
*/

function absoluteBaseUrl(req) {
  // Railway / proxies provide these headers
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// 1) SSE handshake: stream a single `endpoint` event with the absolute /messages URL
app.get("/sse", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const base = absoluteBaseUrl(req);
  const endpointUrl = `${base}/messages`;

  // Claude expects:  event: endpoint\n data: <url>\n\n
  res.write(`event: endpoint\n`);
  res.write(`data: ${endpointUrl}\n\n`);

  // Keep the connection open (Claude may hold it for a bit)
  req.on("close", () => {
    try {
      res.end();
    } catch {}
  });
});

// 2) HTTP message endpoint – hand off to the SDK’s HTTP handler
// NOTE: No auth here; Claude does not send Authorization headers.
app.post("/messages", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    await mcp.handleHttp(req, res);
  } catch (err) {
    console.error("MCP HTTP handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "internal_error" });
    }
  }
});

/** ---- Start server ---------------------------------------------------- */

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
