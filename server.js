import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const app = express();

// Create an MCP server instance (no tools registered yet)
const mcp = new Server(
  { name: "openphone-history-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// small helper to build absolute URL behind proxies (Railway)
function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Claude handshake endpoint: Server-Sent Events
app.get("/sse", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // Tell Claude where to POST MCP HTTP messages
  res.write(`event: endpoint\n`);
  res.write(`data: ${baseUrl(req)}/messages\n\n`);

  req.on("close", () => { try { res.end(); } catch {} });
});

// MCP HTTP transport: Claude will POST here
app.post("/messages", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    await mcp.handleHttp(req, res);
  } catch (err) {
    console.error("MCP HTTP error:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
});

// simple health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`Listening on :${PORT}`));
