# openphone-history-mcp

Minimal MCP server for Claude Connectors.

## Endpoints
- `GET /sse` streams a single `endpoint` event with the public `/messages` URL
- `POST /messages` is handled by `@modelcontextprotocol/sdk` (HTTP transport)

## Railway
- Expose your service publicly on **port 8080**
- Your public URL should look like: `https://<service>.up.railway.app`
- In Claude → **Add custom connector**:
  - Name: `openphone-history-mcp`
  - Remote MCP server URL: `https://<service>.up.railway.app/sse`
  - Leave OAuth Client ID/Secret **blank**
  - Click **Add** and then **Connect**
