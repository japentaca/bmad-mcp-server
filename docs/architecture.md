# BMAD Development Platform — Architecture

**Version:** 3.1.0  
**Last Updated:** May 2026

---

## Overview

Monorepo with 3 packages implementing the full BMAD development lifecycle:

```
packages/
├── shared/     # @bmad/shared — DB layer (knex), types, utilities
├── mcp/        # bmad-mcp-extended — MCP server (legacy compat)
└── web/        # @bmad/web — Astro app: kanban, projects, orchestration
```

**Agents are self-contained markdown files** in `vendor/bmad/`. No external MCP server or GitHub dependency required.

## Two-Mode Architecture

| Mode | Interface | Purpose |
|------|-----------|---------|
| **Dialogue** | OpenCode TUI | PM/architect/UX dialog — embody agents by reading their .md files |
| **Execution** | Web UI → SDK | Automated dev → review → test pipeline per story |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     DIALOGUE MODE                             │
│                                                               │
│  OpenCode TUI                                                │
│  > Read vendor/bmad/pm.md                                    │
│  > Help me define requirements for X                         │
│                                                               │
│  You embody the agent directly. The agent persona is the     │
│  markdown file. Outputs (PRDs, specs, stories) are saved     │
│  as documents in the DB.                                      │
└──────────────────────────┬───────────────────────────────────┘
                           │ shared DB
┌──────────────────────────▼───────────────────────────────────┐
│                     EXECUTION MODE                             │
│                                                               │
│  Web UI (Astro + Vue)                                         │
│  ├── Kanban board (created → in-progress → review → done)     │
│  ├── Gantt chart, Project dashboard                           │
│  ├── Activity console (WebSocket real-time)                   │
│  │                                                            │
│  │  [Start Dev] button click                                  │
│  │       │                                                    │
│  │       ▼                                                    │
│  │  DevOrchestrator (lib/dev.ts)                              │
│  │  ├── Loads vendor/bmad/dev.md                              │
│  │  ├── Stage 1: DEV — injects persona + story                │
│  │  ├── Loads vendor/bmad/reviewer.md                         │
│  │  ├── Stage 2: REVIEW — adversarial code review             │
│  │  ├── Loads vendor/bmad/tea.md                              │
│  │  ├── Stage 3: TEST — run tests, verify                     │
│  │  └── Each stage: fresh OpenCode SDK session (200k context) │
│  │                                                            │
│  │  WebSocket ──▶ ActivityConsole (live progress)             │
│  └────────────────────────────────────────────────────────────│
│                                                               │
│  OpenCode SDK (@opencode-ai/sdk, optional dependency)         │
│  └── session.create() → session.prompt() → result             │
└───────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### Agent Definitions (`vendor/bmad/`)
- **dev.md** — Implement stories, write tests
- **reviewer.md** — Adversarial code review, find bugs
- **tea.md** — Run tests, verify correctness
- **pm.md** — Define PRDs, epics, stories
- **architect.md** — Design architecture, tech decisions
- **analyst.md** — Market research, requirements
- **ux-designer.md** — User flows, interface design
- **sm.md** — Sprints, retros, process
- **debug.md** — Root cause analysis, bug fixing

### Web App (`packages/web`)
- **Framework:** Astro 6 + Vue 3 (SSR)
- **DB access:** `lib/db.ts` — knex with SQLite fallback
- **Orchestrator:** `lib/dev.ts` — job queue, 3-stage pipeline, OpenCode SDK integration
- **WebSocket:** `lib/ws-server.ts` — real-time activity log
- **API:** REST endpoints for projects, documents, stories, workflows
- **Components:** `KanbanBoard.vue`, `GanttChart.vue`, `ActivityConsole.vue`

### Shared (`packages/shared`)
- `KnexStorage` — full DB layer (projects, documents, workflow_status, activity_log)
- `BMADStorage` interface — abstracts PostgreSQL/SQLite
- Types, logger, WebSocket client

---

## Dev Pipeline: 3-Stage Flow

```
[Start Dev] → DEV (implementing) → REVIEW (reviewing) → TEST (testing) → DONE
                  │                      │                    │
                  ▼                      ▼                    ▼
           vendor/bmad/           vendor/bmad/          vendor/bmad/
             dev.md                reviewer.md            tea.md
```

Pipeline is sequential — one story at a time. No merge conflicts, no race conditions.

### Stage Results

| Stage | Success | Failure |
|-------|---------|---------|
| DEV | Proceeds to REVIEW | Story marked as failed, retryable |
| REVIEW | `approved: true` → proceeds | `severity: critical` → rejected. Otherwise → feedback, retryable |
| TEST | `allPassing: true` → DONE | Story moved back to In Progress, retryable |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `bmad_projects` | Project registry |
| `bmad_documents` | PRDs, stories, specs (versioned) |
| `bmad_workflow_status` | Story/step tracking (JSON status) |
| `bmad_activity_log` | Audit trail |

**Workflow status flags used by Kanban:**
- `{ started: true }` → In Progress
- `{ inReview: true }` → Code Review
- `{ completed: true }` → Done
- No status → Created

---

## Key Files

| File | Role |
|------|------|
| `vendor/bmad/*.md` | Agent definitions — source of truth |
| `packages/web/src/lib/dev.ts` | Orchestrator: job queue, agent loading, 3-stage pipeline |
| `packages/web/src/lib/db.ts` | DB access |
| `packages/web/src/lib/ws-server.ts` | WebSocket real-time activity |
| `packages/web/src/components/KanbanBoard.vue` | Kanban with Start Dev + Retry |
| `packages/shared/src/storage/knex-storage.ts` | DB layer (all tables) |
| `AGENTS.md` | Agent instructions for AI assistants |
