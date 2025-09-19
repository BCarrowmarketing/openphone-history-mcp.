// Minimal MCP server for Claude (no SDK)
// Tools: openphone-list-phone-numbers, openphone-list-messages, openphone-list-calls
import express from "express";
import { WebSocketServer } from "ws";
import { request } from "undici";

const PORT = process.env.PORT || 3000;
const API_BASE = "https://api.openphone.com/v1";
const API_KEY = process.env.OPENPHONE_API_KEY;
if (!API_KEY) { console.error("Missing OPENPHONE_API_KEY"); process.exit(1); }

async function opGet(path, query) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await request(url, { method: "GET", headers: { Authorization: `Bearer ${API_KEY}` } });
  if (res.statusCode >= 400) throw new Error(`OpenPhone ${res.statusCode}: ${await res.body.text()}`);
  return res.body.json();
}

const TOOLS = [
  {
    name: "openphone-list-phone-numbers",
    description: "List OpenPhone numbers in the workspace",
    inputSchema: { type: "object", properties: {} }
  },
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
  }
];

// HTTP server (healthcheck)
const app = express();
app.get("/", (_req, res) => res.status(200).send("OpenPhone History MCP up"));
const http = app.listen(PORT, () => console.log("HTTP on :" + PORT));

// WebSocket endpoint that speaks enough MCP for Claude
const wss = new WebSocketServer({ server: http, path: "/mcp" });

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    try {
      // 1) Handshake
      if (msg.type === "initialize") {
        ws.send(JSON.stringify({
          type: "initialized",
          protocolVersion: "2024-11-05", // plain string ok for Claude
          capabilities: { tools: {} }     // declare tool capability
        }));
        return;
      }

      // 2) Tool listing
      if (msg.type === "tools/list") {
        ws.send(JSON.stringify({
          type: "tools/list_result",
          tools: TOOLS
        }));
        return;
      }

      // 3) Tool calls
      if (msg.type === "tool/call") {
        const { name, arguments: args, call_id } = msg;
        let data;
        if (name === "openphone-list-phone-numbers") {
          data = await opGet("/phone-numbers");
        } else if (name === "openphone-list-messages") {
          data = await opGet("/messages", args || {});
        } else if (name === "openphone-list-calls") {
          data = await opGet("/calls", args || {});
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }

        ws.send(JSON.stringify({
          type: "tool/call_result",
          call_id,
          content: [{ type: "json", data }]
        }));
        return;
      }

      // Optional keepalive
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
    } catch (e) {
      // MCP error envelope
      const payload = { type: "error", error: String(e?.message || e) };
      ws.send(JSON.stringify(payload));
    }
  });
});
