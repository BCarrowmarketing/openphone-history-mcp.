import express from "express";

const app = express();

// Enable JSON parsing FIRST
app.use(express.json({ limit: "2mb" }));

// Enable CORS and MCP headers for ALL routes
app.use((req, res, next) => {
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle OPTIONS preflight
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
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const endpoint = `${proto}://${host}/messages`;
  
  console.log("Sending endpoint:", endpoint);
  
  res.write(`event: endpoint\n`);
  res.write(`data: ${endpoint}\n\n`);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`:keepalive\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
    res.end();
  });
});

// Main MCP message handler
app.post("/messages", async (req, res) => {
  try {
    const request = req.body;
    console.log("MCP Request:", JSON.stringify(request, null, 2));

    // Set MCP protocol headers
    res.setHeader('MCP-Protocol-Version', '2025-06-18');
    if (req.headers['mcp-session-id']) {
      res.setHeader('MCP-Session-Id', req.headers['mcp-session-id']);
    }

    // Validate request structure
    if (!request || !request.method) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: request?.id || null,
        error: { code: -32600, message: "Invalid Request" }
      });
    }

    let response;

    switch (request.method) {
      case "initialize":
        console.log("Initialize request received");
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { 
              tools: {},
              logging: {}
            },
            serverInfo: { 
              name: "openphone-mcp", 
              version: "1.0.0" 
            }
          }
        };
        break;

      case "initialized":
        console.log("Initialized notification received");
        // This is a notification, no response needed
        return res.status(200).send();

      case "notifications/initialized":
        console.log("Notifications initialized received");
        // Alternative notification format
        return res.status(200).send();

      case "tools/list":
        console.log("Tools list request received");
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: [
              {
                name: "list_calls",
                description: "Retrieve call history from OpenPhone",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { 
                      type: "number", 
                      description: "Number of calls to retrieve (max 100)", 
                      default: 20 
                    }
                  }
                }
              },
              {
                name: "list_contacts",
                description: "Retrieve contacts from OpenPhone",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { 
                      type: "number", 
                      description: "Number of contacts to retrieve (max 100)", 
                      default: 20 
                    },
                    search: { 
                      type: "string", 
                      description: "Search contacts by name or phone number" 
                    }
                  }
                }
              },
              {
                name: "send_text_message",
                description: "Send a text message via OpenPhone",
                inputSchema: {
                  type: "object",
                  properties: {
                    to: { 
                      type: "string", 
                      description: "Phone number to send message to (E.164 format)" 
                    },
                    from: { 
                      type: "string", 
                      description: "Your OpenPhone number to send from (E.164 format)" 
                    },
                    text: { 
                      type: "string", 
                      description: "Message content" 
                    }
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
                    limit: { 
                      type: "number", 
                      description: "Number of messages to retrieve (max 100)", 
                      default: 20 
                    },
                    conversationId: { 
                      type: "string", 
                      description: "Filter messages for specific conversation ID" 
                    }
                  }
                }
              },
              {
                name: "list_phone_numbers",
                description: "List all phone numbers in your OpenPhone account",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { 
                      type: "number", 
                      description: "Number of phone numbers to retrieve", 
                      default: 20 
                    }
                  }
                }
              }
            ]
          }
        };
        break;

      case "tools/call":
        console.log("Tool call request:", request.params);
        try {
          const { name, arguments: args } = request.params;
          const result = await callOpenPhoneAPI(name, args || {});
          
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [{ type: "text", text: result }]
            }
          };
        } catch (error) {
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [{ 
                type: "text", 
                text: `Error: ${error.message}` 
              }],
              isError: true
            }
          };
        }
        break;

      default:
        console.error("Unknown method:", request.method);
        return res.status(404).json({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` }
        });
    }

    console.log("Sending response:", JSON.stringify(response, null, 2));
    res.json(response);

  } catch (error) {
    console.error("MCP Error:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: { code: -32603, message: "Internal error", data: error.message }
    });
  }
});

// OpenPhone API handler
async function callOpenPhoneAPI(toolName, args) {
  const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
  
  if (!OPENPHONE_API_KEY) {
    throw new Error("OPENPHONE_API_KEY environment variable is required");
  }

  if (!OPENPHONE_API_KEY.startsWith('op_')) {
    throw new Error("Invalid API key format. OpenPhone API keys must start with 'op_'");
  }

  const headers = {
    'Authorization': OPENPHONE_API_KEY,
    'Content-Type': 'application/json'
  };

  const baseUrl = 'https://api.openphone.com/v1';

  try {
    switch (toolName) {
      case "list_calls": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        
        const response = await fetch(`${baseUrl}/calls?${params}`, { headers });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status}`);
        }
        
        return `Retrieved ${data.data?.length || 0} calls:\n\n${JSON.stringify(data, null, 2)}`;
      }

      case "list_contacts": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.search) params.append('search', args.search);
        
        const response = await fetch(`${baseUrl}/contacts?${params}`, { headers });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status}`);
        }
        
        return `Retrieved ${data.data?.length || 0} contacts:\n\n${JSON.stringify(data, null, 2)}`;
      }

      case "send_text_message": {
        const body = {
          to: args.to,
          from: args.from,
          text: args.text
        };

        const response = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status}`);
        }
        
        return `Message sent successfully:\n\n${JSON.stringify(data, null, 2)}`;
      }

      case "list_messages": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.conversationId) params.append('conversationId', args.conversationId);
        
        const response = await fetch(`${baseUrl}/messages?${params}`, { headers });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status}`);
        }
        
        return `Retrieved ${data.data?.length || 0} messages:\n\n${JSON.stringify(data, null, 2)}`;
      }

      case "list_phone_numbers": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        
        const response = await fetch(`${baseUrl}/phone-numbers?${params}`, { headers });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `API error: ${response.status}`);
        }
        
        return `Retrieved ${data.data?.length || 0} phone numbers:\n\n${JSON.stringify(data, null, 2)}`;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`OpenPhone API error for ${toolName}:`, error);
    throw error;
  }
}

// Health checks for Railway
app.get("/health", (_req, res) => res.json({ 
  status: "healthy",
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
}));

app.get("/healthz", (_req, res) => res.json({ 
  ok: true,
  timestamp: new Date().toISOString()
}));

// Root endpoint
app.get("/", (_req, res) => res.json({ 
  name: "openphone-mcp",
  version: "1.0.0",
  status: "running"
}));

// Start server
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`OpenPhone MCP Server listening on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Key configured: ${process.env.OPENPHONE_API_KEY ? 'Yes' : 'No'}`);
});
