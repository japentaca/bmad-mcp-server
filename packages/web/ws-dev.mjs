import { ActivityWsServer } from '../src/lib/ws-server.js';

const token = process.env.BMAD_ACCESS_TOKEN || process.env.API_TOKEN;
if (!token) {
  console.error('[ws-dev] BMAD_ACCESS_TOKEN or API_TOKEN must be set');
  process.exit(1);
}

const port = parseInt(process.env.BMAD_WS_PORT || '3001', 10);

const server = new ActivityWsServer(token);
server.start(port);

console.error(`[ws-dev] WS server on port ${port}`);
console.error('[ws-dev] MCP endpoint:   ws://localhost:' + port + '/ws/mcp?token=***');
console.error('[ws-dev] Dashboard endpoint: ws://localhost:' + port + '/ws/dashboard');

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
