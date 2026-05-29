<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';

interface ActivityEvent {
  type: string;
  payload: Record<string, unknown>;
  clientId?: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  category: string;
  action: string;
  entity: string;
  duration: string;
  success: boolean;
  message: string;
}

const connected = ref(false);
const entries = ref<LogEntry[]>([]);
const paused = ref(false);
const autoScroll = ref(true);
const container = ref<HTMLElement | null>(null);
let ws: WebSocket | null = null;
let counter = 0;

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = '3001';
  return `${protocol}//${window.location.hostname}:${port}/ws/dashboard`;
}

function levelColor(level: string): string {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'info': return '#3b82f6';
    case 'debug': return '#6b7280';
    default: return '#3b82f6';
  }
}

function levelBg(level: string): string {
  switch (level) {
    case 'error': return 'rgba(239,68,68,0.1)';
    case 'warn': return 'rgba(245,158,11,0.1)';
    default: return 'transparent';
  }
}

function formatTime(ts: string): string {
  if (!ts) return new Date().toLocaleTimeString('es-ES', { hour12: false });
  try {
    return new Date(ts).toLocaleTimeString('es-ES', { hour12: false });
  } catch {
    return ts;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function addEntry(event: ActivityEvent): void {
  if (paused.value) return;
  const p = event.payload;

  const entityParts: string[] = [];
  if (p.entity_type) entityParts.push(p.entity_type as string);
  if (p.entity_name) entityParts.push(p.entity_name as string);

  const msgParts: string[] = [];
  if (p.response_summary) msgParts.push(p.response_summary as string);
  if (p.error_message) msgParts.push(p.error_message as string);

  entries.value.push({
    id: ++counter,
    timestamp: (p.timestamp as string) || new Date().toISOString(),
    level: (p.level as string) || 'info',
    category: (p.category as string) || 'unknown',
    action: (p.action as string) || '',
    entity: entityParts.join(':') || '-',
    duration: formatDuration(p.duration_ms as number | null),
    success: !!p.success,
    message: msgParts.join(' | '),
  });

  if (entries.value.length > 500) {
    entries.value = entries.value.slice(-300);
  }

  if (autoScroll.value) {
    nextTick(() => {
      if (container.value) {
        container.value.scrollTop = container.value.scrollHeight;
      }
    });
  }
}

function connect(): void {
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    ws = new WebSocket(wsUrl());
  } catch {
    connected.value = false;
    return;
  }

  ws.onopen = () => {
    connected.value = true;
  };

  ws.onmessage = (event) => {
    try {
      const data: ActivityEvent = JSON.parse(event.data);
      if (data.type === 'activity') {
        addEntry(data);
      }
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    connected.value = false;
    setTimeout(() => {
      if (!connected.value) connect();
    }, 3000);
  };

  ws.onerror = () => {
    connected.value = false;
    if (ws) ws.close();
  };
}

function clearConsole(): void {
  entries.value = [];
  counter = 0;
}

onMounted(() => {
  connect();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
});
</script>

<template>
  <div>
    <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem;">
      <Badge
        :value="connected ? 'Conectado' : 'Desconectado'"
        :severity="connected ? 'success' : 'danger'"
      />
      <span style="font-size: 0.8rem; color: var(--text-color-secondary);">
        {{ entries.length }} eventos
      </span>
      <Button
        :label="paused ? 'Reanudar' : 'Pausar'"
        :icon="paused ? 'pi pi-play' : 'pi pi-pause'"
        severity="secondary"
        size="small"
        text
        @click="paused = !paused"
      />
      <Button
        :label="autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'"
        :icon="autoScroll ? 'pi pi-arrow-down' : 'pi pi-arrow-down'"
        :severity="autoScroll ? 'info' : 'secondary'"
        size="small"
        text
        @click="autoScroll = !autoScroll"
      />
      <Button
        label="Limpiar"
        icon="pi pi-trash"
        severity="danger"
        size="small"
        text
        @click="clearConsole"
      />
    </div>

    <div
      ref="container"
      style="
        background: #0d1117;
        color: #e6edf3;
        border-radius: 0.5rem;
        padding: 0.75rem;
        font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        line-height: 1.5;
        height: calc(100vh - 12rem);
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-all;
      "
    >
      <div v-if="entries.length === 0" style="color: #6b7280; padding: 2rem; text-align: center;">
        Esperando eventos del MCP...
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        :style="{
          padding: '2px 0',
          backgroundColor: levelBg(entry.level),
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }"
      >
        <span style="color: #6b7280;">{{ formatTime(entry.timestamp) }}</span>
        <span :style="{ color: levelColor(entry.level), fontWeight: 'bold', margin: '0 6px' }">{{ entry.level.toUpperCase() }}</span>
        <span style="color: #58a6ff;">[{{ entry.category }}]</span>
        <span style="color: #d2a8ff; margin-left: 6px;">{{ entry.action }}</span>
        <span v-if="entry.entity !== '-'" style="color: #7ee787; margin-left: 6px;">{{ entry.entity }}</span>
        <span v-if="entry.duration" style="color: #f0883e; margin-left: 6px;">{{ entry.duration }}</span>
        <span :style="{ color: entry.success ? '#7ee787' : '#ef4444', marginLeft: '6px' }">
          {{ entry.success ? 'OK' : 'ERR' }}
        </span>
        <span v-if="entry.message" style="color: #8b949e; margin-left: 6px;">{{ entry.message.slice(0, 200) }}</span>
      </div>
    </div>
  </div>
</template>
