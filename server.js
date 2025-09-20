// server.js — STDIO MCP server (no Express)

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const OPENPHONE_BASE_URL = process.env.OPENPHONE_BASE_URL?.trim() || "https://api.openphone.com";
const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY?.trim() || "";

const server = new McpServer({ name: "openphone-history-mcp", version: "0.2.1" }, {});

// --- small helper layer ---
const _registered = new Set();
const registerToolSafe = (srv, def, handler) => {
  const name = def?.name;
  if (!name) throw new Error("Tool definition requires `name`");
  if (_registered.has(name)) {
    console.warn(`Skipping duplicate registration: ${name}`);
    return;
    }
  srv.registerTool(def, handler);
  _registered.add(name);
};

const requireKey = () => {
  if (!OPENPHONE_API_KEY) {
    const e = new Error("Missing OPENPHONE_API_KEY env var.");
    e.code = "NO_KEY";
    throw e;
  }
};

async function http(method, path, { query, body, headers } = {}) {
  const url = new URL(path.startsWith("http") ? path : `${OPENPHONE_BASE_URL}${path}`);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, String(val)));
      else url.searchParams.set(k, String(v));
    }
  }
  const h = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(headers || {})
  };
  if (OPENPHONE_API_KEY) h.Authorization = `Bearer ${OPENPHONE_API_KEY}`;

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText || "Request failed";
    const err = new Error(`HTTP ${res.status} ${res.statusText}: ${msg}`);
    err.details = { url: url.toString(), status: res.status, body: data };
    throw err;
  }

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

// --- tools ---
registerToolSafe(
  server,
  {
    name: "ping",
    description: "Health check (echo).",
    inputSchema: z.object({ text: z.string().default("pong") }).default({ text: "pong" })
  },
  async ({ input }) => ({ content: [{ type: "text", text: `✅ ${input.text}` }] })
);

registerToolSafe(
  server,
  {
    name: "openphone.searchMessages",
    description: "Search messages by free-text query.",
    inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).default(25), cursor: z.string().optional() })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http("GET", "/v1/messages/search", {
      query: { q: input.query, limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

registerToolSafe(
  server,
  {
    name: "openphone.getMessage",
    description: "Get a message by ID.",
    inputSchema: z.object({ messageId: z.string().min(1) })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http("GET", `/v1/messages/${encodeURIComponent(input.messageId)}`);
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

registerToolSafe(
  server,
  {
    name: "openphone.listConversations",
    description: "List conversations.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(25), cursor: z.string().optional() })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http("GET", "/v1/conversations", {
      query: { limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

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
    const { data, meta } = await http("GET", `/v1/conversations/${encodeURIComponent(input.conversationId)}`, {
      query: { limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

registerToolSafe(
  server,
  {
    name: "openphone.searchContacts",
    description: "Search contacts by free-text query.",
    inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).default(25), cursor: z.string().optional() })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http("GET", "/v1/contacts/search", {
      query: { q: input.query, limit: input.limit, cursor: input.cursor }
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

registerToolSafe(
  server,
  {
    name: "openphone.getContact",
    description: "Get a contact by ID.",
    inputSchema: z.object({ contactId: z.string().min(1) })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http("GET", `/v1/contacts/${encodeURIComponent(input.contactId)}`);
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

registerToolSafe(
  server,
  {
    name: "openphone.rawRequest",
    description: "Raw HTTP request to OpenPhone (advanced).",
    inputSchema: z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      path: z.string().min(1),
      query: z.record(z.any()).optional(),
      body: z.record(z.any()).optional(),
      headers: z.record(z.string()).optional()
    })
  },
  async ({ input }) => {
    requireKey();
    const { data, meta } = await http(input.method, input.path, {
      query: input.query, body: input.body, headers: input.headers
    });
    return { content: [{ type: "text", text: JSON.stringify({ meta, data }, null, 2) }] };
  }
);

// --- transport ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("OpenPhone MCP server started (stdio).");
