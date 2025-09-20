import express from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import fetch from "node-fetch";

// ✅ Correct SDK entry points
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// --- Config ---
const PORT = process.env.PORT || 8080;
const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY || ""; // optional for now

// --- Create MCP server ---
const server = new McpServer(
  {
    name: "openphone-history-mcp",
    version: "0.1.0"
  },
  {
    // You can add model/data resources later if desired
  }
);

// Simple health check tool so you can verify ChatGPT↔️server end-to-end
server.registerTool(
  {
    name: "ping",
    description: "Simple health check",
    inputSchema: z
      .object({ text: z.string().default("pong") })
      .default({ text: "pong" })
  },
  async ({ input }) => {
    return {
      content: [{ type: "text", text: `✅ ${input.text}` }]
    };
  }
);

// (Optional) Example OpenPhone search tool — will no-op if no API key set
server.registerTool(
  {
    name: "openphone.searchMessages",
    description:
      "Search OpenPhone messages by query string (requires OPENPHONE_API_KEY).",
    inputSchema: z.object({
      query: z.string().min(1, "Provide a search query"),
      limit: z.number().int().min(1).max(100).default(20)
    })
  },
  async ({ input }) => {
    if (!OPENPHONE_API_KEY) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "OPENPHONE_API_KEY is not set in the server environment. Add it in Railway first."
          }
        ]
      };
    }

    // TODO: Replace with the exact OpenPhone endpoint & params you want.
    // The path below is a placeholder; consult OpenPhone docs and swap it.
    const url = new URL("https://api.openphone.com/v1/messages");
    url.searchParams.set("q", input.query);
    url.searchParams.set("limit", String(input.limit));

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${OPENPHONE_API_KEY}` }
    });

    if (!r.ok) {
      const body = await r.text();
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `OpenPhone API error ${r.status}: ${body.slice(0, 500)}`
          }
        ]
      };
    }

    const data = await r.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  }
);

// --- SSE transport wiring (works with ChatGPT & Claude MCP) ---
const app = express();
app.use(express.json());

// Keep active transports by sessionId (so reconnects work)
const transports = new Map();

/**
 * 1) Client opens GET /sse  → we create an SSE transport and emit
 *    `event: endpoint\ndata: /messages?sessionId=...`
 * 2) Client then POSTs to /messages?sessionId=... to send MCP messages
 */

// Establish SSE connection and announce the messages endpoint
app.get("/sse", async (req, res) => {
  const sessionId = req.query.sessionId?.toString() || randomUUID();

  // Create a fresh transport for this session
  const transport = new SSEServerTransport("/messages", res);
  transports.set(sessionId, transport);

  // Start the MCP session over this transport
  // (no need to await; it runs with the connection)
  server.connect(transport);

  // Tell the client which messages endpoint to use
  res.write(`event: endpoint\n`);
  res.write(`data: /messages?sessionId=${sessionId}\n\n`);
  // Keep the stream open; SSEServerTransport will manage heartbeats, etc.
});

// Receive MCP messages for a given session
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId?.toString();
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: "Unknown sessionId" });
  }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
