import type { ActivityLogEntry } from '../storage/storage-interface.js';
import WebSocket from 'ws';

export interface WsClientOptions {
  url: string;
  clientId?: string;
  sessionId?: string;
  maxReconnectDelay?: number;
}

interface WsMessage {
  type: 'activity';
  payload: ActivityLogEntry;
  clientId?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string;
  private sessionId: string;
  private maxReconnectDelay: number;
  private reconnectDelay: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private connecting = false;
  private pending: ActivityLogEntry[] = [];
  private maxPending = 200;

  constructor(options: WsClientOptions) {
    this.url = options.url;
    this.clientId = options.clientId || `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sessionId = options.sessionId || '';
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.reconnectDelay = 1000;
  }

  connect(): void {
    if (this.connected || this.connecting) return;
    this.connectInternal();
  }

  private connectInternal(): void {
    if (this.connecting) return;
    this.connecting = true;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.connected = true;
      this.connecting = false;
      this.reconnectDelay = 1000;

      while (this.pending.length > 0) {
        const entry = this.pending.shift();
        if (entry) this.sendRaw(entry);
      }
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.connecting = false;
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      if (this.ws) {
        this.ws.close();
      }
      this.connected = false;
      this.connecting = false;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connectInternal();
    }, this.reconnectDelay);
  }

  disconnect(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.pending = [];
  }

  send(entry: ActivityLogEntry): void {
    const enriched: ActivityLogEntry = {
      ...entry,
      client_id: entry.client_id || this.clientId,
      session_id: entry.session_id || this.sessionId || undefined,
    };

    if (this.connected && this.ws) {
      this.sendRaw(enriched);
    } else {
      if (this.pending.length < this.maxPending) {
        this.pending.push(enriched);
      }
      if (!this.connected && !this.connecting) {
        this.connect();
      }
    }
  }

  private sendRaw(entry: ActivityLogEntry): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const msg: WsMessage = {
        type: 'activity',
        payload: entry,
        clientId: this.clientId,
      };
      this.ws.send(JSON.stringify(msg));
    } catch {
      // swallow
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
