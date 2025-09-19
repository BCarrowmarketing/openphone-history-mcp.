import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// ----- Config -----
const PORT = process.env.PORT || 3000;
const API_BASE = "https://api.openphone.com/v1";
const API_KEY = process.env.OPENPHONE_API_KEY;
if (!API_KEY) {
  console.error("Missing OPENPHONE_API_KEY");
  process.exit(1);
}

// ----- Minimal OpenPhone client (fetch via global) -----
async function opRequest(method, path, queryOrBody) {
  const headers = { Authorization: `Bearer ${API_KEY}` };
  let url = API_BASE + path;
  let body;

  if (method === "GET") {
    const u = new URL(url);
    for (const [k, v] of Object.entries(queryOrBody || {})) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    }
    url = u.toString();
  } else {
    headers["content-type"] = "application/json";
    body = JSON.stringify(queryOrBody || {});
  }

  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenPhone ${res.status}: ${errText}`);
  }
  return res.json();
}

const opGet  = (path, query) => opRequest("GET",  path, query);
const opPost = (path, body)  => opRequest("POST", path, body);

// ----- MCP server -----
const mcp = new McpServer({ name: "openphone-bridge", version: "1.0.0" });

// List numbers
mcp.tool(
  "openphone-list-phone-numbers",
  z.object({}).passthrough().optional(), // no inputs
  async () => ({
    content: [{ type: "json", data: await opGet("/phone-numbers") }]
  })
);

// List messages by phoneNumberId + participant
mcp.tool(
  "openphone-list-messages",
  z.object({
    phoneNumberId: z.string(),
    participants: z.string().describe("E.164, e.g. +12087311250"),
    maxResults: z.number().int().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    pageToken: z.string().optional()
  }),
  async (args) => ({
    content: [{ type: "json", data: await opGet("/messages", args) }]
  })
);

// List calls by phoneNumberId + participant
mcp.tool(
  "openphone-list-calls",
  z.object({
    phoneNumberId: z.string(),
    participants: z.string().describe("E.164, e.g. +12087311250"),
    maxResults: z.number().int().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    pageToken: z.string().optional()
  }),
  async (args) => ({
    content: [{ type: "json", data: await opGet("/calls", args) }]
  })
);

// (Optional) send message
// mcp.tool(
//   "openphone-send-message",
//   z.object({
//     phoneNumberId: z.string(),
//     to: z.string().describe("E.164"),
//     text: z.string()
//   }),
//   async ({ phoneNumberId, to, text }) => ({
//     content: [{ type: "json", data: await opPost("/messages", { phoneNumberId, to, text }) }]
//   })
// );

// ----- Express/SSE wiring -----
const app = express();
app.use(express.json());

// Healthcheck
app.get("/", (_req, res) => res.send("MCP server is running."));

// Hold active transports by session
const transports = new Map();

// Claude opens this SSE stream; SDK handles protocol on it
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);
  transport.onclose = () => transports.delete(transport.sessionId);

  await mcp.connect(transport);
});

// Claude posts protocol messages here (sessionId query param)
app.post("/messages", async (req, res) => {
  const id = req.query.sessionId;
  const transport = transports.get(id);
  if (!id || !transport) return res.status(404).json({ error: "Unknown or missing sessionId" });
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => console.log(`Listening on :${PORT}`));
