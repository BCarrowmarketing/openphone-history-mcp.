import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";

const app = express();

// Create an MCP server instance with comprehensive OpenPhone tools
const server = new Server(
  { name: "openphone-history-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Register all OpenPhone API tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // CALLS
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
            },
            after: {
              type: "string",
              description: "ISO date string to get calls after this date"
            },
            before: {
              type: "string",
              description: "ISO date string to get calls before this date"
            },
            phoneNumberId: {
              type: "string",
              description: "Filter calls for specific phone number ID"
            }
          }
        }
      },
      {
        name: "get_call_by_id",
        description: "Get a specific call by its ID",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              description: "The ID of the call to retrieve",
              required: true
            }
          },
          required: ["callId"]
        }
      },
      {
        name: "get_call_recordings",
        description: "Get recordings for a specific call",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              description: "The ID of the call to get recordings for",
              required: true
            }
          },
          required: ["callId"]
        }
      },
      {
        name: "get_call_summary",
        description: "Get AI-generated summary for a specific call",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              description: "The ID of the call to get summary for",
              required: true
            }
          },
          required: ["callId"]
        }
      },
      {
        name: "get_call_transcription",
        description: "Get AI-generated transcription for a specific call",
        inputSchema: {
          type: "object",
          properties: {
            callId: {
              type: "string",
              description: "The ID of the call to get transcription for",
              required: true
            }
          },
          required: ["callId"]
        }
      },
      
      // CONTACTS
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
            },
            after: {
              type: "string",
              description: "Cursor for pagination"
            }
          }
        }
      },
      {
        name: "create_contact",
        description: "Create a new contact in OpenPhone",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Contact's name",
              required: true
            },
            phoneNumber: {
              type: "string",
              description: "Contact's phone number",
              required: true
            },
            email: {
              type: "string",
              description: "Contact's email address"
            },
            company: {
              type: "string",
              description: "Contact's company"
            },
            customFields: {
              type: "object",
              description: "Custom field values"
            }
          },
          required: ["name", "phoneNumber"]
        }
      },
      {
        name: "get_contact_by_id",
        description: "Get a specific contact by ID",
        inputSchema: {
          type: "object",
          properties: {
            contactId: {
              type: "string",
              description: "The ID of the contact to retrieve",
              required: true
            }
          },
          required: ["contactId"]
        }
      },
      {
        name: "update_contact",
        description: "Update an existing contact",
        inputSchema: {
          type: "object",
          properties: {
            contactId: {
              type: "string",
              description: "The ID of the contact to update",
              required: true
            },
            name: {
              type: "string",
              description: "Contact's name"
            },
            phoneNumber: {
              type: "string",
              description: "Contact's phone number"
            },
            email: {
              type: "string",
              description: "Contact's email address"
            },
            company: {
              type: "string",
              description: "Contact's company"
            },
            customFields: {
              type: "object",
              description: "Custom field values"
            }
          },
          required: ["contactId"]
        }
      },
      {
        name: "delete_contact",
        description: "Delete a contact from OpenPhone",
        inputSchema: {
          type: "object",
          properties: {
            contactId: {
              type: "string",
              description: "The ID of the contact to delete",
              required: true
            }
          },
          required: ["contactId"]
        }
      },
      {
        name: "get_contact_custom_fields",
        description: "Get available custom fields for contacts",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },

      // MESSAGES & CONVERSATIONS
      {
        name: "list_conversations",
        description: "List conversations (message threads)",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of conversations to retrieve",
              default: 20
            },
            after: {
              type: "string",
              description: "Cursor for pagination"
            },
            phoneNumberId: {
              type: "string",
              description: "Filter by phone number ID"
            }
          }
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
            },
            after: {
              type: "string",
              description: "Cursor for pagination"
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
              description: "Phone number to send message to",
              required: true
            },
            from: {
              type: "string",
              description: "Your OpenPhone number to send from",
              required: true
            },
            text: {
              type: "string",
              description: "Message content",
              required: true
            },
            mediaUrls: {
              type: "array",
              items: { type: "string" },
              description: "URLs of media files to attach (for MMS)"
            }
          },
          required: ["to", "from", "text"]
        }
      },
      {
        name: "get_message_by_id",
        description: "Get a specific message by ID",
        inputSchema: {
          type: "object",
          properties: {
            messageId: {
              type: "string",
              description: "The ID of the message to retrieve",
              required: true
            }
          },
          required: ["messageId"]
        }
      },

      // PHONE NUMBERS
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
      },

      // WEBHOOKS
      {
        name: "list_webhooks",
        description: "List all configured webhooks",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of webhooks to retrieve",
              default: 20
            }
          }
        }
      },
      {
        name: "get_webhook_by_id",
        description: "Get a specific webhook by ID",
        inputSchema: {
          type: "object",
          properties: {
            webhookId: {
              type: "string",
              description: "The ID of the webhook to retrieve",
              required: true
            }
          },
          required: ["webhookId"]
        }
      },
      {
        name: "create_message_webhook",
        description: "Create a new webhook for message events",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to receive webhook events",
              required: true
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Event types to subscribe to (e.g., ['message.created', 'message.updated'])",
              required: true
            },
            label: {
              type: "string",
              description: "Label for the webhook"
            },
            status: {
              type: "string",
              enum: ["enabled", "disabled"],
              description: "Webhook status",
              default: "enabled"
            },
            resourceIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific resource IDs"
            }
          },
          required: ["url", "events"]
        }
      },
      {
        name: "create_call_webhook",
        description: "Create a new webhook for call events",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to receive webhook events",
              required: true
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Event types to subscribe to (e.g., ['call.created', 'call.completed'])",
              required: true
            },
            label: {
              type: "string",
              description: "Label for the webhook"
            },
            status: {
              type: "string",
              enum: ["enabled", "disabled"],
              description: "Webhook status",
              default: "enabled"
            },
            resourceIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific resource IDs"
            }
          },
          required: ["url", "events"]
        }
      },
      {
        name: "create_call_summary_webhook",
        description: "Create a new webhook for call summary events",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to receive webhook events",
              required: true
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Event types to subscribe to (e.g., ['call.summary.completed'])",
              required: true
            },
            label: {
              type: "string",
              description: "Label for the webhook"
            },
            status: {
              type: "string",
              enum: ["enabled", "disabled"],
              description: "Webhook status",
              default: "enabled"
            },
            resourceIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific resource IDs"
            }
          },
          required: ["url", "events"]
        }
      },
      {
        name: "create_call_transcript_webhook",
        description: "Create a new webhook for call transcript events",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to receive webhook events",
              required: true
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Event types to subscribe to (e.g., ['call.transcript.completed'])",
              required: true
            },
            label: {
              type: "string",
              description: "Label for the webhook"
            },
            status: {
              type: "string",
              enum: ["enabled", "disabled"],
              description: "Webhook status",
              default: "enabled"
            },
            resourceIds: {
              type: "array",
              items: { type: "string" },
              description: "Filter by specific resource IDs"
            }
          },
          required: ["url", "events"]
        }
      },
      {
        name: "delete_webhook",
        description: "Delete a webhook by ID",
        inputSchema: {
          type: "object",
          properties: {
            webhookId: {
              type: "string",
              description: "The ID of the webhook to delete",
              required: true
            }
          },
          required: ["webhookId"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // You'll need to set your OpenPhone API key as an environment variable
  const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
  
  if (!OPENPHONE_API_KEY) {
    throw new Error("OPENPHONE_API_KEY environment variable is required");
  }

  const headers = {
    'Authorization': `Bearer ${OPENPHONE_API_KEY}`,
    'Content-Type': 'application/json'
  };

  const baseUrl = 'https://api.openphone.com/v1';

  try {
    switch (name) {
      // CALLS
      case "list_calls": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.after) params.append('after', args.after);
        if (args.before) params.append('before', args.before);
        if (args.phoneNumberId) params.append('phoneNumberId', args.phoneNumberId);
        
        const response = await fetch(`${baseUrl}/calls?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} calls:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_call_by_id": {
        const response = await fetch(`${baseUrl}/calls/${args.callId}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call details:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_call_recordings": {
        const response = await fetch(`${baseUrl}/calls/${args.callId}/recordings`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call recordings:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_call_summary": {
        const response = await fetch(`${baseUrl}/calls/${args.callId}/summary`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call summary:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_call_transcription": {
        const response = await fetch(`${baseUrl}/calls/${args.callId}/transcription`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call transcription:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      // CONTACTS
      case "list_contacts": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.search) params.append('search', args.search);
        if (args.after) params.append('after', args.after);
        
        const response = await fetch(`${baseUrl}/contacts?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} contacts:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "create_contact": {
        const body = {
          name: args.name,
          phoneNumbers: [{ value: args.phoneNumber }]
        };
        if (args.email) body.emails = [{ value: args.email }];
        if (args.company) body.company = args.company;
        if (args.customFields) body.customFields = args.customFields;

        const response = await fetch(`${baseUrl}/contacts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Contact created:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_contact_by_id": {
        const response = await fetch(`${baseUrl}/contacts/${args.contactId}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Contact details:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "update_contact": {
        const body = {};
        if (args.name) body.name = args.name;
        if (args.phoneNumber) body.phoneNumbers = [{ value: args.phoneNumber }];
        if (args.email) body.emails = [{ value: args.email }];
        if (args.company) body.company = args.company;
        if (args.customFields) body.customFields = args.customFields;

        const response = await fetch(`${baseUrl}/contacts/${args.contactId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Contact updated:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "delete_contact": {
        const response = await fetch(`${baseUrl}/contacts/${args.contactId}`, {
          method: 'DELETE',
          headers
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        return {
          content: [{
            type: "text",
            text: `Contact deleted successfully`
          }]
        };
      }

      case "get_contact_custom_fields": {
        const response = await fetch(`${baseUrl}/contact-custom-fields`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Contact custom fields:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      // MESSAGES & CONVERSATIONS
      case "list_conversations": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.after) params.append('after', args.after);
        if (args.phoneNumberId) params.append('phoneNumberId', args.phoneNumberId);
        
        const response = await fetch(`${baseUrl}/conversations?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} conversations:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "list_messages": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        if (args.conversationId) params.append('conversationId', args.conversationId);
        if (args.after) params.append('after', args.after);
        
        const response = await fetch(`${baseUrl}/messages?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} messages:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
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
        return {
          content: [{
            type: "text",
            text: `Message sent:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_message_by_id": {
        const response = await fetch(`${baseUrl}/messages/${args.messageId}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Message details:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      // PHONE NUMBERS
      case "list_phone_numbers": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        
        const response = await fetch(`${baseUrl}/phone-numbers?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} phone numbers:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      // WEBHOOKS
      case "list_webhooks": {
        const params = new URLSearchParams();
        if (args.limit) params.append('limit', args.limit.toString());
        
        const response = await fetch(`${baseUrl}/webhooks?${params}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Retrieved ${data.data?.length || 0} webhooks:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "get_webhook_by_id": {
        const response = await fetch(`${baseUrl}/webhooks/${args.webhookId}`, { headers });
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Webhook details:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "create_message_webhook": {
        const body = {
          url: args.url,
          events: args.events,
          status: args.status || 'enabled'
        };
        if (args.label) body.label = args.label;
        if (args.resourceIds) body.resourceIds = args.resourceIds;

        const response = await fetch(`${baseUrl}/webhooks/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Message webhook created:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "create_call_webhook": {
        const body = {
          url: args.url,
          events: args.events,
          status: args.status || 'enabled'
        };
        if (args.label) body.label = args.label;
        if (args.resourceIds) body.resourceIds = args.resourceIds;

        const response = await fetch(`${baseUrl}/webhooks/calls`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call webhook created:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "create_call_summary_webhook": {
        const body = {
          url: args.url,
          events: args.events,
          status: args.status || 'enabled'
        };
        if (args.label) body.label = args.label;
        if (args.resourceIds) body.resourceIds = args.resourceIds;

        const response = await fetch(`${baseUrl}/webhooks/call-summaries`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call summary webhook created:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "create_call_transcript_webhook": {
        const body = {
          url: args.url,
          events: args.events,
          status: args.status || 'enabled'
        };
        if (args.label) body.label = args.label;
        if (args.resourceIds) body.resourceIds = args.resourceIds;

        const response = await fetch(`${baseUrl}/webhooks/call-transcripts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        const data = await response.json();
        return {
          content: [{
            type: "text",
            text: `Call transcript webhook created:\n\n${JSON.stringify(data, null, 2)}`
          }]
        };
      }

      case "delete_webhook": {
        const response = await fetch(`${baseUrl}/webhooks/${args.webhookId}`, {
          method: 'DELETE',
          headers
        });
        
        if (!response.ok) throw new Error(`OpenPhone API error: ${response.status}`);
        return {
          content: [{
            type: "text",
            text: `Webhook deleted successfully`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// small helper to build absolute URL behind proxies (Railway)
function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Claude handshake endpoint: Server-Sent Events
app.get("/sse", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

  // Tell Claude where to POST MCP HTTP messages
  res.write(`event: endpoint\n`);
  res.write(`data: ${baseUrl(req)}/messages\n\n`);

  // Close the connection after sending the endpoint info
  res.end();
});

// Create a simple JSON-RPC handler for MCP messages
app.post("/messages", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const request = req.body;
    console.log("Received MCP request:", JSON.stringify(request, null, 2));
    
    // Handle JSON-RPC format
    if (request.method === "tools/list") {
      try {
        const handler = server.getRequestHandler(ListToolsRequestSchema);
        const response = await handler(request);
        console.log("Tools list response:", JSON.stringify(response, null, 2));
        res.json({
          jsonrpc: "2.0",
          id: request.id,
          result: response
        });
      } catch (handlerError) {
        console.error("Handler error for tools/list:", handlerError);
        res.json({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: "Internal error in tools/list" }
        });
      }
    } else if (request.method === "tools/call") {
      try {
        const handler = server.getRequestHandler(CallToolRequestSchema);
        const response = await handler(request);
        console.log("Tool call response:", JSON.stringify(response, null, 2));
        res.json({
          jsonrpc: "2.0",
          id: request.id,
          result: response
        });
      } catch (handlerError) {
        console.error("Handler error for tools/call:", handlerError);
        res.json({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: "Internal error in tools/call" }
        });
      }
    } else {
      console.log("Unknown method:", request.method);
      res.json({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: "Method not found" }
      });
    }
  } catch (err) {
    console.error("MCP HTTP error:", err);
    if (!res.headersSent) {
      res.json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32603, message: "Internal error" }
      });
    }
  }
});

// simple health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`Listening on :${PORT}`));
