import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';

interface WsMessage {
  type: string;
  payload: Record<string, unknown>;
  clientId?: string;
}

interface McpClient {
  ws: WebSocket;
  clientId: string;
  connectedAt: number;
}

export class ActivityWsServer {
  private wss: WebSocketServer | null = null;
  private mcpClients: Set<McpClient> = new Set();
  private dashboardClients: Set<WebSocket> = new Set();
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  attach(server: Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);
      const pathname = url.pathname;

      if (pathname === '/ws/mcp') {
        if (!this.validateMcpToken(url)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      } else if (pathname === '/ws/dashboard') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);

      if (url.pathname === '/ws/mcp') {
        this.handleMcpConnection(ws, url);
      } else if (url.pathname === '/ws/dashboard') {
        this.handleDashboardConnection(ws);
      }
    });

    console.error('[ws-server] Attached to HTTP server');
  }

  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);

      if (url.pathname === '/ws/mcp') {
        if (!this.validateMcpToken(url)) {
          ws.close(4001, 'Unauthorized');
          return;
        }
        this.handleMcpConnection(ws, url);
      } else if (url.pathname === '/ws/dashboard') {
        this.handleDashboardConnection(ws);
      } else {
        ws.close(4000, 'Unknown path');
      }
    });

    console.error(`[ws-server] Listening on port ${port}`);
  }

  private validateMcpToken(url: URL): boolean {
    const token = url.searchParams.get('token');
    if (!token || token !== this.apiToken) return false;
    return true;
  }

  private handleMcpConnection(ws: WebSocket, url: URL): void {
    const clientId = url.searchParams.get('clientId') || `mcp-${Date.now()}`;

    const client: McpClient = {
      ws,
      clientId,
      connectedAt: Date.now(),
    };

    this.mcpClients.add(client);
    console.error(`[ws-server] MCP connected: ${clientId}`);

    ws.on('message', (data) => {
      try {
        const msg: WsMessage = JSON.parse(data.toString());
        msg.clientId = clientId;
        this.broadcastToDashboard(JSON.stringify(msg));
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      this.mcpClients.delete(client);
      console.error(`[ws-server] MCP disconnected: ${clientId}`);
    });

    ws.on('error', () => {
      this.mcpClients.delete(client);
    });
  }

  private handleDashboardConnection(ws: WebSocket): void {
    this.dashboardClients.add(ws);

    ws.on('close', () => {
      this.dashboardClients.delete(ws);
    });

    ws.on('error', () => {
      this.dashboardClients.delete(ws);
    });
  }

  private broadcastToDashboard(message: string): void {
    for (const ws of this.dashboardClients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch {
          this.dashboardClients.delete(ws);
        }
      }
    }
  }

  getMcpClientCount(): number {
    return this.mcpClients.size;
  }

  getDashboardClientCount(): number {
    return this.dashboardClients.size;
  }

  close(): void {
    for (const client of this.mcpClients) {
      client.ws.close();
    }
    for (const ws of this.dashboardClients) {
      ws.close();
    }
    this.mcpClients.clear();
    this.dashboardClients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}
