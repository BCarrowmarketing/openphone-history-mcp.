import express from "express";
import cors from "cors";
import morgan from "morgan";
import fetch from "node-fetch";
import {
  McpServer,
  SSEServerTransport
} from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "@modelcontextprotocol/sdk/schema.js";

const SHARED_SECRET = process.env.MCP_SHARED_SECRET || "";        // set in Railway
const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;          // set in Railway
const OPENPHONE_BASE = process.env.OPENPHONE_BASE_URL || "https://api.openphone.com/v1";
const PORT = process.env.PORT || 8080;

if (!OPENPHONE_API_KEY) {
  console.error("Missing OPENPHONE_API_KEY env var");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// Simple bearer gate for clients (ChatGPT / you)
app.use((req, res, next) => {
  if (!SHARED_SECRET) return next(); // public (not recommended)
  const hdr = req.get("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (token !== SHARED_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// -------- OpenPhone helper --------
async function opFetch(path, options = {}) {
  const url = `${OPENPHONE_BASE}${path}`;
  const r = await fetch(url, {
    ...options,
    headers: {
      "Authorization": OPENPHONE_API_KEY, // OpenPhone expects the API key here
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`OpenPhone ${r.status} ${r.statusText}: ${body || "(no body)"}`);
  }
  return r.json();
}

// -------- MCP server & tools --------
const mcp = new McpServer({ name: "openphone-mcp", version: "1.0.0" });

// Health check
mcp.tool(
  "ping",
  "Health check for the MCP server",
  { schema: z.object({}).optional() },
  async () => ({ ok: true, now: new Date().toISOString() })
);

// List phone numbers
mcp.tool(
  "list_phone_numbers",
  "List phone numbers in your OpenPhone workspace",
  { schema: z.object({ page: z.number().optional(), limit: z.number().optional() }).optional() },
  async ({ page = 1, limit = 50 } = {}) => {
    return opFetch(`/phone-numbers?page=${page}&limit=${limit}`);
  }
);

// Send SMS
mcp.tool(
  "send_message",
  "Send an SMS via OpenPhone",
  {
    schema: z.object({
      from: z.string().describe("E.164 number to send from, e.g. +15551234567"),
      to: z.array(z.string()).nonempty().describe("Array of recipient E.164 numbers"),
      content: z.string().describe("Message body"),
      userId: z.string().optional().describe("Optional OpenPhone userId to send as")
    })
  },
  async ({ from, to, content, userId }) => {
    const body = { from, to, content, ...(userId ? { userId } : {}) };
    return opFetch(`/messages`, { method: "POST", body: JSON.stringify(body) });
  }
);

// List messages
mcp.tool(
  "list_messages",
  "List messages. Optionally filter by phoneNumberId or pagination cursors.",
  {
    schema: z.object({
      phoneNumberId: z.string().optional(),
      limit: z.number().optional(),
      newerThan: z.string().optional(),
      olderThan: z.string().optional()
    }).optional()
  },
  async ({ phoneNumberId, limit = 50, newerThan, olderThan } = {}) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (phoneNumberId) params.set("phoneNumberId", phoneNumberId);
    if (newerThan) params.set("newerThan", newerThan);
    if (olderThan) params.set("olderThan", olderThan);
    return opFetch(`/messages?${params.toString()}`);
  }
);

// Get message by id
mcp.tool(
  "get_message",
  "Get a single message by id",
  { schema: z.object({ id: z.string() }) },
  async ({ id }) => opFetch(`/messages/${encodeURIComponent(id)}`)
);

// List contacts
mcp.tool(
  "list_contacts",
  "List contacts in your workspace",
  { schema: z.object({ page: z.number().optional(), limit: z.number().optional() }).optional() },
  async ({ page = 1, limit = 50 } = {}) => opFetch(`/contacts?page=${page}&limit=${limit}`)
);

// Get contact
mcp.tool(
  "get_contact",
  "Get a single contact by id",
  { schema: z.object({ id: z.string() }) },
  async ({ id }) => opFetch(`/contacts/${encodeURIComponent(id)}`)
);

// List calls
mcp.tool(
  "list_calls",
  "List calls (call history). Pagination supported.",
  { schema: z.object({ page: z.number().optional(), limit: z.number().optional() }).optional() },
  async ({ page = 1, limit = 50 } = {}) => opFetch(`/calls?page=${page}&limit=${limit}`)
);

// Expose MCP over HTTP/SSE for clients
const transport = new SSEServerTransport({ path: "/sse" });
await transport.attach(mcp, app);

// Root
app.get("/", (_, res) => {
  res.json({ status: "ok", service: "openphone-mcp", sse: "/sse" });
});

app.listen(PORT, () => {
  console.log(`OpenPhone MCP listening on :${PORT}`);
});
