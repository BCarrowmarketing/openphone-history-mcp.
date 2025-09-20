import express from "express";

const app = express();

// OpenPhone API tools definition
const OPENPHONE_TOOLS = [
  {
    name: "list_calls",
    description: "Retrieve call history from OpenPhone",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of calls to retrieve (max 100)", default: 20 },
        after: { type: "string", description: "ISO date string to get calls after this date" },
        before: { type: "string", description: "ISO date string to get calls before this date" },
        phoneNumberId: { type: "string", description: "Filter calls for specific phone number ID" }
      }
    }
  },
  {
    name: "list_contacts",
    description: "Retrieve contacts from OpenPhone", 
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of contacts to retrieve (max 100)", default: 20 },
        search: { type: "string", description: "Search contacts by name or phone number" },
        after: { type: "string", description: "Cursor for pagination" }
      }
    }
  },
  {
    name: "send_text_message",
    description: "Send a text message via OpenPhone",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Phone number to send message to" },
        from: { type: "string", description: "Your OpenPhone number to send from" },
        text: { type: "string", description: "Message content" },
        mediaUrls: { type: "array", items: { type: "string" }, description: "URLs of media files to attach (for MMS)" }
      },
      required: ["to", "from", "text"]
    }
  },
  {
    name: "list_messages",
    description: "Retrieve message history from OpenPhone",
    inputSchema: {
      type: "object", 
      properties: {
        limit: { type: "number", description: "Number of messages to retrieve (max 100)", default: 20 },
        conversationId: { type: "string", description: "Filter messages for specific conversation ID" },
        after: { type: "string", description: "Cursor for pagination" }
      }
    }
  },
  {
    name: "list_phone_numbers",
    description: "List all phone numbers in your OpenPhone account",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of phone numbers to retrieve", default: 20 }
      }
    }
  }
];

// OpenPhone API handler
async function callOpenPhoneAPI(toolName, args) {
  const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
  
  if (!OPENPHONE_API_KEY) {
    throw new Error("OPENPHONE_API_KEY environment variable is required");
  }

  const headers = {
    'Authorization': `Bearer ${OPENPHONE_API_KEY}`,
    'Content-Type': 'application/json'
  };

  const baseUrl = 'https://api.openphone.com/v1';

  switch (toolName) {
    case "list_calls": {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.after) params.append('after', args.after);
      if (args.before) params.append('before', args.before);
      if (args.phoneNumberId) params.append('phoneNumberId', args.phoneNumberId);
      
      const response = await fetch(`${baseUrl}/calls?${params}`, { headers });
      if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
      const data = await response.json();
      return `Retrieved ${data.data?.length || 0} calls:\n\n${JSON.stringify(data, null, 2)}`;
    }

    case "list_contacts": {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.search) params.append('search', args.search);
      if (args.after) params.append('after', args.after);
      
      const response = await fetch(`${baseUrl}/contacts?${params}`, { headers });
      if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
      const data = await response.json();
      return `Retrieved ${data.data?.length || 0} contacts:\n\n${JSON.stringify(data, null, 2)}`;
    }

    case "send_text_message": {
      const body = {
        to: args.to,
        from: args.from,
        text: args.text
      };
      if (args.mediaUrls) body.mediaUrls = args.mediaUrls;

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
      const data = await response.json();
      return `Message sent:\n\n${JSON.stringify(data, null, 2)}`;
    }

    case "list_messages": {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      if (args.conversationId) params.append('conversationId', args.conversationId);
      if (args.after) params.append('after', args.after);
      
      const response = await fetch(`${baseUrl}/messages?${params}`, { headers });
      if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
      const data = await response.json();
      return `Retrieved ${data.data?.length || 0} messages:\n\n${JSON.stringify(data, null, 2)}`;
    }

    case "list_phone_numbers": {
      const params = new URLSearchParams();
      if (args.limit) params.append('limit', args.limit.toString());
      
      const response = await fetch(`${baseUrl}/phone-numbers?${params}`, { headers });
      if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
      const data = await response.json();
      return `Retrieved ${data.data?.length || 0} phone numbers:\n\n${JSON.stringify(data, null, 2)}`;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Helper function to build absolute URL
function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// SSE endpoint for Claude handshake
app.get("/sse", (req, res) => {
  console.log("SSE endpoint hit");
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

  const endpoint = `${baseUrl(req)}/messages`;
  console.log("Sending endpoint:", endpoint);
  
  res.write(`event: endpoint\n`);
  res.write(`data: ${endpoint}\n\n`);
  res.end();
});

// Main MCP message handler
app.post("/messages", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const request = req.body;
    console.log("MCP Request:", JSON.stringify(request, null, 2));

    // Ensure we have proper request structure
    if (!request || !request.method) {
      console.error("Invalid request structure:", request);
      return res.status(400).json({
        jsonrpc: "2.0",
        id: request?.id || null,
        error: { code: -32600, message: "Invalid Request" }
      });
    }

    let result;

    switch (request.method) {
      case "initialize":
        console.log("Initialize request received");
        result = {
          protocolVersion: "2025-06-18",
          capabilities: { 
            tools: {},
            logging: {}
          },
          serverInfo: { 
            name: "openphone-mcp", 
            version: "1.0.0" 
          }
        };
        break;

      case "initialized":
        console.log("Initialized notification received");
        result = {};
        break;

      case "tools/list":
        console.log("Tools list request received");
        result = { tools: OPENPHONE_TOOLS };
        break;

      case "tools/call":
        console.log("Tool call request received:", request.params);
        try {
          if (!request.params || !request.params.name) {
            throw new Error("Tool name is required");
          }
          
          const { name, arguments: args } = request.params;
          console.log(`Calling tool: ${name} with args:`, args);
          
          const apiResult = await callOpenPhoneAPI(name, args || {});
          result = {
            content: [{ type: "text", text: apiResult }]
          };
        } catch (error) {
          console.error("Tool call error:", error);
          result = {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true
          };
        }
        break;

      default:
        console.error("Unknown method:", request.method);
        return res.status(404).json({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Method not found" }
        });
    }

    const response = {
      jsonrpc: "2.0",
      id: request.id,
      result: result
    };
    
    console.log("Sending response:", JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error("MCP Error:", error);
    res.status(500).json({
      jsonrpc: "2.0", 
      id: request.body?.id || null,
      error: { code: -32603, message: "Internal error", data: error.message }
    });
  }
});

// Health check
app.get("/healthz", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`OpenPhone MCP Server listening on :${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
});
