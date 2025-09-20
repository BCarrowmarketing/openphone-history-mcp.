# OpenPhone MCP (ChatGPT custom tool server)

### Env vars (Railway → Variables)
- `OPENPHONE_API_KEY` – your OpenPhone API key
- `MCP_SHARED_SECRET` – any long random string
- `OPENPHONE_BASE_URL` – optional (defaults to `https://api.openphone.com/v1`)
- `PORT` – defaults to 8080

### Endpoints for MCP client
- SSE stream: `https://<railway-app>.up.railway.app/sse`
- Root: `https://<railway-app>.up.railway.app/`

### Local quick test
```bash
curl -i -H "Authorization: Bearer $MCP_SHARED_SECRET" https://<railway-app>.up.railway.app/
curl -i -N -H "Authorization: Bearer $MCP_SHARED_SECRET" https://<railway-app>.up.railway.app/sse
