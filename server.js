import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import {
  McpServer,
  StdioServerTransport,         // (not used, but fine to keep)
  createExpressHttpServer,      // ← gives you /sse and /messages endpoints
} from '@modelcontextprotocol/sdk/server/express';

// ----- config -----
const PORT = process.env.PORT || 8080;
const SHARED_SECRET = process.env.CLAUDE_SHARED_SECRET || ''; // 64-hex you generated

// ----- Auth (shared-secret via Authorization: Bearer <secret>) -----
function authMiddleware(req, res, next) {
  // Claude will set: Authorization: Bearer <secret>
  const hdr = req.headers['authorization'] || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  if (SHARED_SECRET && token !== SHARED_SECRET) {
    res.set('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ----- Build MCP server & tools -----
const mcp = new McpServer({
  name: 'openphone-history-mcp',
  version: '0.1.0'
});

// Simple health/echo tool
mcp.tool({
  name: 'ping',
  description: 'Health check',
  inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
  async *invoke({ message = 'pong' }) {
    return { content: [{ type: 'text', text: String(message) }] };
  }
});

// Example: list recent OpenPhone calls (stubbed; replace with your API)
mcp.tool({
  name: 'list_recent_calls',
  description: 'List recent OpenPhone calls (stub)',
  inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
  async *invoke({ limit = 5 }) {
    // TODO: call OpenPhone API here using your API key
    const calls = Array.from({ length: limit }, (_, i) => ({
      id: `call_${i + 1}`,
      from: '+15551234567',
      to: '+15557654321',
      durationSec: 42 + i
    }));
    return { content: [{ type: 'json', json: calls }] };
  }
});

// ----- Express HTTP transport for MCP -----
const app = express();
app.set('trust proxy', true);

app.get('/health', (_req, res) => res.json({ ok: true }));

// The SDK wires /sse and /messages. Protect both with the auth middleware.
const { router } = createExpressHttpServer({ server: mcp });
app.use(authMiddleware, router);

// root page to avoid Railway 404 splash & for quick sanity checks
app.get('/', (_req, res) =>
  res.type('text').send('openphone-history-mcp is running. Try /health or /sse with Authorization header.')
);

// ----- Start -----
const http = createServer(app);
http.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
