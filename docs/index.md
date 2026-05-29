# BMAD Development Platform — Documentation

**Version:** 3.1.0 | **Last Updated:** May 2026

---

## Quick Start

```bash
git clone <repo-url> && cd bmad-platform
npm install && npm run build
cd packages/web && npm run dev
# Open http://localhost:4321
```

---

## Documentation

| Doc | Purpose |
|-----|---------|
| **[Getting Started](getting-started.md)** | Guía práctica: instalar, configurar, flujo de trabajo |
| [Architecture](architecture.md) | System design, components, 3-stage pipeline |
| [API Contracts](api-contracts.md) | MCP tools, REST API endpoints |
| [Development Guide](development-guide.md) | Build, test, debug, contribute |

---

## Project Structure

```
bmad-platform/
├── vendor/bmad/       # Agent definitions (9 self-contained .md files)
│   ├── dev.md          # Developer
│   ├── reviewer.md     # Adversarial code reviewer
│   ├── tea.md          # Test architect
│   ├── pm.md           # Product manager
│   ├── architect.md    # System architect
│   ├── analyst.md      # Business analyst
│   ├── ux-designer.md  # UX designer
│   ├── sm.md           # Scrum master
│   └── debug.md        # Debug specialist
├── packages/
│   ├── shared/         # DB layer, types, utilities
│   ├── mcp/            # MCP server (legacy compat)
│   └── web/            # Admin UI (Astro + Vue) + Orchestrator
├── docs/               # Documentation
└── AGENTS.md           # AI agent instructions
```

## Two-Mode Architecture

| Mode | How | Purpose |
|------|-----|---------|
| **Dialogue** | OpenCode TUI → `Read vendor/bmad/pm.md` | PM, architect, analyst dialog |
| **Execution** | Web UI → SDK | Automated dev → review → test per story |

## Agents

All agents are self-contained markdown files. No MCP server required. Edit them directly in `vendor/bmad/`. The orchestrator loads them at runtime.
