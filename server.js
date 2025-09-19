// OpenPhone History MCP Server (SDK-based) — works with Claude
import express from "express";
import { WebSocketServer } from "ws";
import { request } from "undici";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebSocketTransport } from "@modelcontextprotocol/sdk/server/ws.js";

const PORT = process.env.PORT || 3000;
const API_BASE = "https://api.openphone.com/v1";
const API_KEY = process.env.OPENPHONE_API_KEY;
if (!API_KEY) {
  console.error("Missing OPENPHONE_API_KEY");
  process.exit(1);
}

// --- Helpers to call OpenPhone REST ---
async function opGet(path, query) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await request(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  if (res.statusCode >= 400) throw new Error(`OpenPhone ${res.statusCode}: ${await res.body.text()}`);
  return res.body.json();
}

// (Optional) POST for send-message if you want it later
async function opPost(path, body) {
  const res = await request(API_BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (res.statusCode >= 400) throw new Error(`OpenPhone ${res.statusCode}: ${await res.body.text()}`);
  return res.body.json();
}

// --- Healthcheck HTTP ---
const app = express();
app.get("/", (_req, res) => res.status(200).send("OpenPhone History MCP up"));
const httpServer = app.listen(PORT, () => console.log("HTTP on :" + PORT));

// --- WebSocket endpoint that speaks MCP (accept the 'mcp' subprotocol) ---
const wss = new WebSocketServer({
  server: httpServer,
  path: "/mcp",
  handleProtocols: (protocols) => (protocols.includes("mcp") ? "mcp" : false)
});

// One MCP server per WS connection
wss.on("connection", (ws) => {
  const mcp = new Server({ name: "openphone-history", version: "1.0.0" });

  // Tool: list numbers
  mcp.tool(
    {
      name: "openphone-list-phone-numbers",
      description: "List OpenPhone numbers in the workspace",
      inputSchema: { type: "object", properties: {} }
    },
    async () => ({ content: [{ type: "json", data: await opGet("/phone-numbers") }] })
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
    async (args) => ({ content: [{ type: "json", data: await opGet("/messages", args) }] })
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
    async (args) => ({ content: [{ type: "json", data: await opGet("/calls", args) }] })
  );

  // (Optional) Tool: send message — uncomment if you want sending too
  // mcp.tool(
  //   {
  //     name: "openphone-send-message",
  //     description: "Send an SMS/MMS from a specific phoneNumberId",
  //     inputSchema: {
  //       type: "object",
  //       properties: {
  //         phoneNumberId: { type: "string" },
 //         to: { type: "string", description: "E.164" },
  //         text: { type: "string" }
  //       },
  //       required: ["phoneNumberId", "to", "text"]
  //     }
  //   },
  //   async ({ phoneNumberId, to, text }) => ({
  //     content: [{ type: "json", data: await opPost("/messages", { phoneNumberId, to, text }) }]
  //   })
  // );

  const transport = new WebSocketTransport(ws);
  mcp.connect(transport);
});
