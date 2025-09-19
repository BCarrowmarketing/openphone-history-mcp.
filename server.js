import express from "express";
import { randomUUID } from "crypto";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Optional shared secret (set in Railway if you want to enforce it)
const SHARED = process.env.CLAUDE_SHARED_SECRET || "";

// Middleware: accept/optionally check Bearer token, but never fail hard
app.use((req, res, next) => {
  const auth = req.get("authorization") || "";
  // If you configured a secret, enforce it
  if (SHARED) {
    const ok = auth.startsWith("Bearer ") && auth.slice(7) === SHARED;
    if (!ok) return res.status(401).json({ error: "unauthorized" });
  }
  // If no secret configured, accept any/no token
  next();
});

// Health route Claude pings during “Connect”
app.get("/", (_req, res) => res.status(200).json({ ok: true, transport: "mcp-http-sse" }));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// --- SSE session registry (very simple) ---
const sessions = new Map(); // sessionId -> { res }

app.get("/sse", (req, res) => {
  // SSE headers
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const sessionId = randomUUID();
  sessions.set(sessionId, { res });

  // tell client where to POST messages
  res.write(`event: endpoint\n`);
  res.write(`data: /messages?sessionId=${sessionId}\n\n`);

  req.on("close", () => {
    sessions.delete(sessionId);
  });
});

// Claude will POST tool calls here
app.post("/messages", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: "invalid session" });
  }

  // Handle MCP JSON-RPC payload from Claude here.
  // For now, echo a minimal success to prove auth/transport:
  res.json({ ok: true });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on :${port}`);
});
