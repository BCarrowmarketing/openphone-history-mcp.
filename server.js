// server.js
import express from "express";
import crypto from "crypto";

const app = express();

// ---- config ----
const PORT = process.env.PORT || 8080;
const SHARED = process.env.CLAUDE_SHARED_SECRET || "";

// Simple auth middleware
function requireAuth(req, res, next) {
  const auth = req.get("authorization") || "";
  const got = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const ok = SHARED && crypto.timingSafeEqual(Buffer.from(SHARED), Buffer.from(got || ""));
  if (!ok) {
    res.set("WWW-Authenticate", 'Bearer realm="mcp", charset="UTF-8"');
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

// CORS (Claude connects server-to-server, but this doesn’t hurt)
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health (Claude pings this)
app.get("/", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    transport: "mcp-http-sse",
    implementation: { name: "openphone-history-mcp", version: "0.1.0" }
  });
});

// SSE entry (Claude connects here)
app.get("/sse", requireAuth, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const sessionId = crypto.randomUUID();
  res.write(`event: endpoint\n`);
  res.write(`data: /messages?sessionId=${sessionId}\n\n`);
  // keep-alive
  const ping = setInterval(() => res.write(`:\n\n`), 15000);
  req.on("close", () => clearInterval(ping));
});

// Claude will POST/stream here after SSE handshake
app.use(express.json({ limit: "1mb" }));
app.post("/messages", requireAuth, (req, res) => {
  // TODO: your MCP logic (tools, prompts, etc). For now just echo.
  res.json({ ok: true, received: req.body || {} });
});

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
