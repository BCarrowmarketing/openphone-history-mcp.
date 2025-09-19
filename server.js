import express from "express";
import { WebSocketServer } from "ws";
import { request } from "undici";

const PORT = process.env.PORT || 3000;
const API_BASE = "https://api.openphone.com/v1";
const API_KEY = process.env.OPENPHONE_API_KEY;
if (!API_KEY) { console.error("Missing OPENPHONE_API_KEY"); process.exit(1); }

const app = express();
app.get("/", (_req, res) => res.status(200).send("OpenPhone History MCP up"));
const httpServer = app.listen(PORT, () => console.log("HTTP on :" + PORT));

const wss = new WebSocketServer({ server: httpServer, path: "/mcp" });

async function opGet(path, query) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await request(url, { method: "GET", headers: { Authorization: `Bearer ${API_KEY}` } });
  if (res.statusCode >= 400) throw new Error(`OpenPhone ${res.statusCode}: ${await res.body.text()}`);
  return res.body.json();
}

function toolDefs() {
  return {
    "openphone-list-phone-numbers": {
      description: "List OpenPhone numbers in the workspace",
      inputSchema: { type: "object", properties: {} }
    },
    "openphone-list-messages": {
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
    "openphone-list-calls": {
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
  };
}

wss.on("connection", (socket) => {
  socket.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "tools/list") {
        const tools = toolDefs();
        const items = Object.entries(tools).map(([name, def]) => ({ name, ...def }));
        socket.send(JSON.stringify({ type: "tools/list_result", tools: items }));
        return;
      }

      if (msg.type === "tool/call") {
        const { name, arguments: args, call_id } = msg;
        let data;
        if (name === "openphone-list-phone-numbers") data = await opGet("/phone-numbers");
        else if (name === "openphone-list-messages") data = await opGet("/messages", args);
        else if (name === "openphone-list-calls") data = await opGet("/calls", args);
        else throw new Error(`Unknown tool: ${name}`);

        socket.send(JSON.stringify({
          type: "tool/call_result",
          call_id,
          content: [{ type: "json", data }]
        }));
      }
    } catch (e) {
      socket.send(JSON.stringify({ type: "error", error: String(e?.message || e) }));
    }
  });
});
