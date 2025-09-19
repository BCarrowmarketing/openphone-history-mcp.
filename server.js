// OpenPhone History MCP Server (WebSocket transport)
import express from "express";
import { WebSocketServer } from "ws";
import { request } from "undici";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebSocketTransport } from "@modelcontextprotocol/sdk/server/ws.js";

const PORT = process.env.PORT || 3000;
const API_BASE = "https://api.openphone.com/v1";
const API_KEY = process.env.OPENPHONE_API_KEY;
if (!API_KEY) { console.error("Missing OPENPHONE_API_KEY"); process.exit(1); }

// --- plain helper to call OpenPhone REST ---
async function opGet(path, query) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await request(url, { method: "GET", headers: { Authorization: `Bearer ${API_KEY}` } });
  if (res.statusCode >= 400) throw new Error(`OpenPhone ${res.statusCode}: ${await res.body.text()}`);
  return res.body.json();
}

// --- HTTP server just for healthcheck and WS upgrade target ---
const app = express();
app.get("/", (_req, res) => res.status(200).send("OpenPhone History MCP up"));
const httpServer = app.listen(PORT, () => console.log("HTTP on :" + PORT));

// --- WebSocket endpoint for MCP ---
const wss = new WebSocketServer({ server: httpServer, path: "/mcp" });

wss.on("connection", (ws) => {
  // Create one MCP server per connection
  const mcp = new Server({ name: "openphone-history", version: "1.0.0" });

  // Tool: list numbers
  mcp.tool(
    {
      name: "openphone-list-phone-numbers",
      description: "List OpenPhone numbers in the workspace",
      inputSchema: { type: "object", properties: {} }
    },
    async () => {
      const data = await opGet("/phone-numbers");
      return { content: [{ type: "json", data }] };
    }
  );

  // Tool: list messages
  mcp.tool(
    {
      name: "openphone-list-messages",
      description: "List messages with a participant for a given phoneNumberId",
      inputSchema: {
        type: "object",
        properties: {
          phoneNumberId: { type: "string" },
          participants: { type: "string", description: "E.164, e.g. +12087311250" },
          maxResults: { type: "number" },
          createdAfter: { type: "string" },
          createdBefore: { type: "string" },
          pageToken: { type: "string" }
        },
        required: ["phoneNumberId", "participants"]
      }
    },
    async (args) => {
      const data = await opGet("/messages", args);
      return { content: [{ type: "json", data }] };
    }
  );

  // Tool: list calls
  mcp.tool(
    {
      name: "openphone-list-calls",
      description: "List calls with a participant for a given phoneNumberId",
      inputSchema: {
        type: "object",
        properties: {
          phoneNumberId: { type: "string" },
          participants: { type: "string", description: "E.164, e.g. +12087311250" },
          maxResults: { type: "number" },
          createdAfter: { type: "string" },
          createdBefore: { type: "string" },
          pageToken: { type: "string" }
        },
        required: ["phoneNumberId", "participants"]
      }
    },
    async (args) => {
      const data = await opGet("/calls", args);
      return { content: [{ type: "json", data }] };
    }
  );

  // Bridge this socket to the MCP server
  const transport = new WebSocketTransport(ws);
  mcp.connect(transport);
});
