// server.js
// MCP server for OpenPhone with duplicate-registration guard.
// Works on Node 18+ (fetch is built-in). ESM module (type: module).

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ---------- Config ----------
const OPENPHONE_BASE_URL = process.env.OPENPHONE_BASE_URL?.trim() || "https://api.openphone.com";
const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY?.trim() || "";

// ---------- Helpers ----------

// Deduplicate tool registration across module reloads/imports
const _registered = new Set();
function registerToolSafe(server, def, handler) {
  const name = def?.name;
  if (!name || typeof name !== "string") {
    throw new Error("Tool definition requires a unique string `name`.");
  }
  if (_registered.has(name)) {
    console.warn(`Skipping duplicate tool registration: ${name}`);
    return;
  }
  server.registerTool(def, handler);
  _registered.add(name);
}

// Simple fetch wrapper with nicer errors + optional retries
async function http(method, path, { query, body, headers } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${OPENPHONE_BASE_URL}${path}`);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, String(val)));
      else url.searchParams.set(k, String(v));
    }
  }

  const h = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(headers || {})
  };

  if (OPENPHONE_API_KEY) {
    h.Authorization = `Bearer ${OPENPHONE_API_KEY}`;
  }

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || res.statusText || "Request failed";
    const errorPayload = {
      status: res.status,
      statusText: res.statusText,
      url: url.toString(),
      message: msg,
      body: data
    };
    const e = new Error(`HTTP ${res.status} ${res.statusText}: ${msg}`);
    e.details = errorPayload;
    throw e;
  }

  // Return both JSON and some headers you may care about (rate limits, etc.)
  return {
    data,
    meta: {
      url: url.toString(),
      status: res.status,
      rateLimitLimit: res.headers.get("x-ratelimit-limit"),
      rateLimitRemaining: res.headers.get("x-ratelimit-remaining"),
      rateLimitReset: res.headers.get("x-ratelimit-reset"),
      requestId: res.headers.get("x-request-id")
    }
  };
}

function requireKey() {
  if (!OPENPHONE_API_KEY) {
    const e = new Error("Missing OPENPHONE_API_KEY. Set it in your Railway / environment variables.");
    e.code = "NO_KEY";
    throw e;
  }
}

// ---------- Server ----------
const server = new McpServer(
  { name: "openphone-history-mcp", version: "0.2.0" },
  {}
);

// ---------- Tools ----------

// 1) Health check
registerToolSafe(
  server,
  {
    name: "ping",
    description: "Simple health check. Echoes back your text.",
    inputSchema: z.object({
      text: z.string().default("pong")
    }).default({ text: "pong" })
  },
  async ({ input }) => {
    return {
      content: [{ type: "text", text: `✅ ${input.text}` }]
    };
  }
);

// 2) OpenPhone: search messages (generic text search)
registerToolSafe(
  server,
  {
    name: "openphone.searchMessages",
    description: "Search OpenPhone messages by a free-text query.",
    inputSchema: z.object({
      query: z.string().min(1, "Enter a search query"),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().optional()
    })
  },
  async ({ input }) => {
    requireKey();
    // NOTE: Path may differ depending on OpenPhone API; adjust if needed.
    const path = "/v1/messages/search";
    const { data, meta } = await http("GET", path, {
      query: { q: input.query, limit: input.limit, cursor: input.cursor }
    });
    return {
      content: [
        { type: "text", text: JSON.stringify({ meta, data }, null, 2) }
      ]
    };
  }
);

// 3) OpenPhone: get a specific message by ID
registerToolSafe(
  server,
  {
    name: "openphone.getMessage",
    description: "Get a specific OpenPhone message by ID.",
    inputSchema: z.object({
      messageId: z.string().min(1)
    })
  },
  async ({ input }) => {
    requireKey();
    const path = `/v1/messages/${encodeURIComponent(input.messageId)}`;
    const { data, meta } = await http("GET", path);
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// 4) OpenPhone: list conversations
registerToolSafe(
  server,
  {
    name: "openphone.listConversations",
    description: "List conversations (threads) in OpenPhone.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().optional()
    })
  },
  async ({ input }) => {
    requireKey();
    const path = "/v1/conversations";
    const { data, meta } = await http("GET", path, {
      query: { limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// 5) OpenPhone: get conversation by ID
registerToolSafe(
  server,
  {
    name: "openphone.getConversation",
    description: "Get a conversation (thread) by ID.",
    inputSchema: z.object({
      conversationId: z.string().min(1),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.string().optional()
    })
  },
  async ({ input }) => {
    requireKey();
    const path = `/v1/conversations/${encodeURIComponent(input.conversationId)}`;
    const { data, meta } = await http("GET", path, {
      query: { limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// 6) OpenPhone: search contacts
registerToolSafe(
  server,
  {
    name: "openphone.searchContacts",
    description: "Search contacts by free-text query (name, phone, email, etc.).",
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(25),
      cursor: z.string().optional()
    })
  },
  async ({ input }) => {
    requireKey();
    const path = "/v1/contacts/search";
    const { data, meta } = await http("GET", path, {
      query: { q: input.query, limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// 7) OpenPhone: get contact by ID
registerToolSafe(
  server,
  {
    name: "openphone.getContact",
    description: "Get a contact by ID.",
    inputSchema: z.object({
      contactId: z.string().min(1)
    })
  },
  async ({ input }) => {
    requireKey();
    const path = `/v1/contacts/${encodeURIComponent(input.contactId)}`;
    const { data, meta } = await http("GET", path);
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// 8) OpenPhone: raw request (advanced)
// Use this to hit endpoints not wrapped above. Be careful with body/headers.
registerToolSafe(
  server,
  {
    name: "openphone.rawRequest",
    description:
      "Make a raw HTTP request to the OpenPhone API. Useful for endpoints not covered by other tools.",
    inputSchema: z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      path: z.string().min(1).describe("Path starting with /v1/... (or full URL)."),
      query: z.record(z.any()).optional(),
      body: z.record(z.any()).optional(),
      headers: z.record(z.string()).optional()
    })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http(input.method, input.path, {
      query: input.query,
      body: input.body,
      headers: input.headers
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// ---------- Transport ----------
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("OpenPhone MCP server started (stdio).");
