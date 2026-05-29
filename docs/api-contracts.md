# API Contracts — BMAD Development Platform

**Version:** 3.1.0  
**Last Updated:** May 2026

---

## MCP Tool: `bmad` (DB persistence only)

The MCP server exposes a single `bmad` tool for database operations. Agent discovery and execution are handled via `vendor/bmad/` markdown files, not through the MCP.

### Tool Schema

```json
{
  "name": "bmad",
  "description": "Database persistence for BMAD documents and workflow status.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "operation": {
        "type": "string",
        "enum": ["db"]
      },
      "workflow": { "type": "string" },
      "agent": { "type": "string" },
      "db": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "enum": ["save", "read", "list", "search", "status-save", "status-read", "status-list"]
          },
          "path": { "type": "string" },
          "content": { "type": "string" },
          "contentType": { "type": "string" },
          "query": { "type": "string" },
          "language": { "type": "string" },
          "limit": { "type": "number" },
          "offset": { "type": "number" },
          "status": { "type": "object" },
          "projectName": { "type": "string" }
        }
      }
    },
    "required": ["operation", "db"]
  }
}
```

### DB Operations

```javascript
// Save
bmad({ operation: "db", db: { action: "save", path: "prd/ecommerce.md", content: "..." } })

// Read
bmad({ operation: "db", db: { action: "read", path: "prd/ecommerce.md" } })

// List
bmad({ operation: "db", db: { action: "list" } })

// Full-text search
bmad({ operation: "db", db: { action: "search", query: "authentication", language: "english" } })

// Workflow status
bmad({ operation: "db", db: { action: "status-save", status: { step: 1 } }, workflow: "prd" })
bmad({ operation: "db", db: { action: "status-read" }, workflow: "prd" })
```

---

## REST API (Web App)

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project `{ name, config }` |
| `GET` | `/api/projects/:name` | Get project details |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/:name/documents?contentType=&workflow=&limit=` | List documents |
| — | via MCP `db.save` | Create/update documents |

### Workflow Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects/:name/workflows` | Get all workflow statuses |

### Story Execution

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/stories/_/execute` | `{ projectName, storyId, storyPath }` | Enqueue story for execution. Returns `{ jobId, status: "queued" }` |
| `GET` | `/api/stories/:id/status?projectName=&storyPath=` | — | Get execution status |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/logs` | List activity logs |
| `GET` | `/api/logs/stats` | Activity statistics |

---

## WebSocket API

### Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `ws://localhost:3001/ws/mcp?token=xxx` | Token | MCP activity events |
| `ws://localhost:3001/ws/dashboard` | None | Dashboard activity console |

### Message Format

```json
{
  "type": "activity",
  "payload": {
    "timestamp": "2026-05-29T...",
    "level": "info",
    "category": "agent_execution",
    "action": "execute",
    "entity_type": "story",
    "entity_name": "login-form",
    "success": true,
    "duration_ms": 1234
  }
}
```

---

## TypeScript API

### Orchestrator (`lib/dev.ts`)

```typescript
import { getOrchestrator } from './lib/dev';

const orchestrator = getOrchestrator();

// Enqueue a story for execution
const jobId = orchestrator.enqueue('my-project', 42, 'stories/login-form.md');

// Listen for events
orchestrator.on('job-queued', (job) => {});
orchestrator.on('job-started', (job) => {});
orchestrator.on('job-progress', ({ job, stage, step }) => {});
orchestrator.on('job-completed', (job) => {});
orchestrator.on('job-failed', (job) => {});

// Query jobs
const job = orchestrator.getJob(jobId);
const projectJobs = orchestrator.getProjectJobs('my-project');
```

### Doc Watcher (`lib/doc-watcher.ts`)

```typescript
import { startDocWatcher, stopDocWatcher } from './lib/doc-watcher';

// Watch a directory and auto-sync .md files to DB
startDocWatcher('./docs', 'my-project');
stopDocWatcher();
```

### DB Access (`lib/db.ts`)

```typescript
import { getDb, initDb, getStorage } from './lib/db';

const db = getDb();
await db.initialize();
await db.saveDocument({ projectName, path, content, contentType, workflow, agent });
await db.saveWorkflowStatus({ projectName, workflow, status, updatedAt });
```
